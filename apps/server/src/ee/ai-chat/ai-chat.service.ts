import { Injectable, Logger } from '@nestjs/common';
import { ServerResponse } from 'http';
import { AiChatRepo } from './ai-chat.repo';
import { OpenAICompatibleProviderFactory } from '../ai/providers/openai-compatible.provider';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { EmbeddingsService } from '../ai/embeddings/embeddings.service';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { ChatMessage } from '../ai/providers/ai-provider.interface';

/**
 * AI Chat service. Streams model output via Server-Sent Events on the
 * `/api/ai/chats/send` endpoint. Persists user + assistant messages and
 * optionally enriches the prompt with semantic search results from the
 * workspace's page_embeddings (RAG).
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly repo: AiChatRepo,
    private readonly providerFactory: OpenAICompatibleProviderFactory,
    private readonly environmentService: EnvironmentService,
    private readonly embeddings: EmbeddingsService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  // ---- non-streaming CRUD ----

  async createChat(workspaceId: string, creatorId: string, title?: string) {
    return this.repo.createChat({
      workspaceId,
      creatorId,
      title: title ?? null,
    });
  }

  async listChats(workspaceId: string, creatorId: string, limit = 50) {
    return this.repo.listChatsByCreator(workspaceId, creatorId, limit);
  }

  async getChatInfo(chatId: string, workspaceId: string) {
    const chat = await this.repo.findChatById(chatId, workspaceId);
    if (!chat) return null;
    const messages = await this.repo.listMessages(chatId, workspaceId);
    return { chat, messages };
  }

  async deleteChat(chatId: string, workspaceId: string) {
    await this.repo.softDeleteChat(chatId, workspaceId);
  }

  async updateChatTitle(chatId: string, workspaceId: string, title: string) {
    return this.repo.updateChatTitle(chatId, workspaceId, title);
  }

  async searchChats(workspaceId: string, creatorId: string, query: string) {
    return this.repo.searchChats(workspaceId, creatorId, query);
  }

  // ---- streaming send ----

  /**
   * Streams a chat completion to the client as Server-Sent Events. Returns
   * the final assistant message id once the stream closes.
   */
  async sendStream(
    res: ServerResponse,
    args: {
      chatId?: string;
      content: string;
      workspaceId: string;
      creatorId: string;
      mentionedPageIds?: string[];
      contextPageId?: string;
      attachmentIds?: string[];
    },
  ): Promise<string> {
    // 1. resolve or create chat
    const chat = args.chatId
      ? await this.repo.findChatById(args.chatId, args.workspaceId)
      : null;

    let chatId: string;
    if (chat) {
      chatId = chat.id;
    } else {
      const created = await this.repo.createChat({
        workspaceId: args.workspaceId,
        creatorId: args.creatorId,
        title: args.content.slice(0, 80) || null,
      });
      chatId = created.id;
      this.sendSse(res, { type: 'chat_created', chatId });
    }

    // 2. persist user message
    const userMsg = await this.repo.insertMessage({
      chatId,
      workspaceId: args.workspaceId,
      userId: args.creatorId,
      role: 'user',
      content: args.content,
      toolCalls: null,
      metadata: {
        mentionedPageIds: args.mentionedPageIds ?? [],
        contextPageId: args.contextPageId ?? null,
        attachmentIds: args.attachmentIds ?? [],
      },
    });

    // 3. build messages array (history + new user msg)
    const history = await this.repo.listMessages(chatId, args.workspaceId);
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...history
        .filter((m) => m.id !== userMsg.id)
        .map(toChatMessage)
        .filter((m): m is ChatMessage => m !== null),
      { role: 'user', content: args.content },
    ];

    // 4. RAG context from page embeddings (always attempt; service is a no-op
    //    when the workspace has no embeddings). Wrapped in try/catch so a
    //    vector search failure does not abort the chat.
    try {
      const ctx = await this.embeddings.retrieveContext({
        workspaceId: args.workspaceId,
        query: args.content,
        limit: 5,
      });
      if (ctx.length) {
        const ctxBlock =
          'Relevant workspace pages:\n' +
          ctx
            .map(
              (c, i) =>
                `[#${i + 1}] (${c.title})\n${c.snippet}`,
            )
            .join('\n\n');
        messages.splice(1, 0, { role: 'system', content: ctxBlock });
      }
    } catch (err: any) {
      this.logger.warn(`RAG context skipped: ${err.message}`);
    }

    // 5. stream completion
    const provider = this.providerFactory.create();
    const chatModel = this.environmentService.getAiChatModel();
    let assistantContent = '';
    const toolCalls: any[] = [];

    try {
      for await (const chunk of provider.streamChat({
        model: chatModel,
        messages,
        temperature: 0.4,
      })) {
        if (chunk.contentDelta) {
          assistantContent += chunk.contentDelta;
          this.sendSse(res, { type: 'content', text: chunk.contentDelta });
        }
        if (chunk.toolCallDeltas.length) {
          toolCalls.push(...chunk.toolCallDeltas);
          for (const tc of chunk.toolCallDeltas) {
            this.sendSse(res, {
              type: 'tool_call',
              id: tc.id,
              name: tc.function.name,
              args: safeParseArgs(tc.function.arguments),
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Stream error: ${err.message}`);
      this.sendSse(res, { type: 'error', message: err.message });
    }

    // 6. persist assistant message
    const assistant = await this.repo.insertMessage({
      chatId,
      workspaceId: args.workspaceId,
      userId: null,
      role: 'assistant',
      content: assistantContent || null,
      toolCalls: toolCalls.length ? toolCalls : null,
      metadata: null,
    });

    this.sendSse(res, {
      type: 'done',
      messageId: assistant.id,
    });

    return assistant.id;
  }

  // ---- helpers ----

  private sendSse(res: ServerResponse, payload: unknown) {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      /* connection closed mid-stream */
    }
  }
}

function toChatMessage(m: {
  role: string;
  content: string | null;
  toolCalls: any;
}): ChatMessage | null {
  if (m.role === 'user') return { role: 'user', content: m.content ?? '' };
  if (m.role === 'assistant') {
    return {
      role: 'assistant',
      content: m.content,
      toolCalls: m.toolCalls ?? undefined,
    };
  }
  if (m.role === 'tool') return { role: 'tool', content: m.content };
  return null;
}

function buildSystemPrompt(): string {
  return [
    'You are Docmost AI, a helpful assistant inside a collaborative wiki.',
    'Answer concisely in the user\'s language. Cite page titles when you use them.',
    'If you do not know the answer, say so.',
  ].join(' ');
}

function safeParseArgs(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args);
  } catch {
    return { _raw: args };
  }
}

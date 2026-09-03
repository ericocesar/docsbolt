import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import {
  AiProvider,
  ChatMessage,
  ChatRequest,
  ChatResponseChunk,
  ChatToolCall,
  EmbeddingRequest,
  EmbeddingResponse,
} from './ai-provider.interface';

const providerLogger = new Logger('AiProviderFactory');

interface OpenAICompatOptions {
  apiKey: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * OpenAI-compatible provider — works with OpenAI, Azure, OpenRouter and any
 * provider that implements the `/chat/completions` and `/embeddings` endpoints
 * in the OpenAI shape.
 */
export class OpenAICompatibleProvider implements AiProvider {
  private readonly logger = new Logger(OpenAICompatibleProvider.name);

  constructor(private readonly opts: OpenAICompatOptions) {}

  private get urlBase(): string {
    return this.opts.baseUrl.replace(/\/+$/, '');
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.opts.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.opts.defaultHeaders ?? {}),
    };
  }

  private toOpenAIMessages(messages: ChatMessage[]) {
    return messages.map((m) => {
      const out: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.name) out.name = m.name;
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
      if (m.toolCalls && m.toolCalls.length) out.tool_calls = m.toolCalls;
      return out;
    });
  }

  async *streamChat(req: ChatRequest): AsyncIterable<ChatResponseChunk> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: this.toOpenAIMessages(req.messages),
      stream: true,
      stream_options: { include_usage: true },
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
      ...(req.tools ? { tools: req.tools } : {}),
      ...(req.toolChoice ? { tool_choice: req.toolChoice } : {}),
    };

    const res = await fetch(`${this.urlBase}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `AI provider ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Track tool-call assembly across chunks (OpenAI streams args incrementally)
    const toolCallBuffers = new Map<
      number,
      { id: string; name: string; args: string }
    >();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            // Flush any pending tool-call buffers
            for (const tc of toolCallBuffers.values()) {
              yield {
                contentDelta: '',
                toolCallDeltas: [
                  {
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.name, arguments: tc.args },
                  },
                ],
              };
            }
            toolCallBuffers.clear();
            return;
          }

          let parsed: any;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }

          // Usage chunk (stream_options: include_usage) — emitted once at end
          if (parsed.usage && !parsed.choices) {
            yield {
              contentDelta: '',
              toolCallDeltas: [],
              usage: {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              },
            };
            continue;
          }

          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta ?? {};
          const contentDelta: string = delta.content ?? '';
          const toolDeltas: ChatToolCall[] = [];
          const finishReason: string | undefined = choice.finish_reason;

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0;
              const buf =
                toolCallBuffers.get(idx) ??
                { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
              if (tc.id) buf.id = tc.id;
              if (tc.function?.name) buf.name = tc.function.name;
              if (typeof tc.function?.arguments === 'string') {
                buf.args += tc.function.arguments;
              }
              toolCallBuffers.set(idx, buf);
              // Yield incremental delta for this chunk
              toolDeltas.push({
                id: buf.id,
                type: 'function',
                function: {
                  name: tc.function?.name ?? buf.name,
                  arguments: tc.function?.arguments ?? '',
                },
              });
            }
          }

          yield {
            contentDelta,
            toolCallDeltas: toolDeltas,
            finishReason,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async chat(req: ChatRequest) {
    let content = '';
    const toolCalls: ChatToolCall[] = [];
    let usage: ChatResponseChunk['usage'];
    let finishReason: string | undefined;

    for await (const chunk of this.streamChat(req)) {
      if (chunk.contentDelta) content += chunk.contentDelta;
      if (chunk.toolCallDeltas.length) toolCalls.push(...chunk.toolCallDeltas);
      if (chunk.usage) usage = chunk.usage;
      if (chunk.finishReason) finishReason = chunk.finishReason;
    }

    // De-duplicate / merge tool-call deltas into complete tool calls
    const merged = mergeToolCalls(toolCalls);

    return { content, toolCalls: merged, finishReason, usage };
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    const body: Record<string, unknown> = {
      model: req.model,
      input: req.input,
    };
    if (req.dimensions !== undefined) body.dimensions = req.dimensions;

    const res = await fetch(`${this.urlBase}/embeddings`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Embedding provider ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`,
      );
    }

    const json: any = await res.json();
    const embeddings: number[][] = (json.data ?? []).map(
      (d: any) => d.embedding,
    );

    return {
      embeddings,
      model: json.model ?? req.model,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }
}

function mergeToolCalls(deltas: ChatToolCall[]): ChatToolCall[] {
  const byId = new Map<string, ChatToolCall>();
  for (const tc of deltas) {
    const existing = byId.get(tc.id);
    if (!existing) {
      byId.set(tc.id, {
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      });
    } else {
      existing.function.arguments += tc.function.arguments;
      if (!existing.function.name && tc.function.name) {
        existing.function.name = tc.function.name;
      }
    }
  }
  return Array.from(byId.values());
}

/**
 * Nest-injectable wrapper that picks the right provider based on env.
 * Docmost currently only ships the OpenAI-compatible path — Gemini/Ollama
 * adapters can extend this factory without changing call sites.
 */
@Injectable()
export class OpenAICompatibleProviderFactory {
  private cached?: OpenAICompatibleProvider;

  constructor(private readonly environmentService: EnvironmentService) {}

  create(): OpenAICompatibleProvider {
    if (this.cached) return this.cached;

    const driver = this.environmentService.getAiDriver();
    const apiKey = this.environmentService.getOpenAiApiKey();
    const apiUrl = this.environmentService.getOpenAiApiUrl();

    providerLogger.log(
      `driver=${driver} apiKeyLen=${apiKey?.length ?? 0} apiKeyPrefix="${apiKey?.slice(0, 10)}..." apiUrl=${apiUrl}`,
    );

    if (driver !== 'openai' && driver !== 'openai-compatible') {
      throw new Error(
        `AI driver "${driver}" is not implemented in this build. ` +
          `Only "openai" and "openai-compatible" are supported.`,
      );
    }
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_DRIVER is set');
    }

    // OpenRouter needs an attribution header; harmless elsewhere
    const headers: Record<string, string> = {};
    if (apiUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] =
        this.environmentService.getAppUrl() ?? 'http://localhost:3000';
      headers['X-Title'] = 'Docmost';
    }

    this.cached = new OpenAICompatibleProvider({
      apiKey,
      baseUrl: apiUrl ?? 'https://api.openai.com/v1',
      defaultHeaders: headers,
    });
    return this.cached;
  }
}

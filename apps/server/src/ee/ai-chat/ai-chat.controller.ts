import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { User } from '@docmost/db/types/entity.types';
import { AiChatService } from './ai-chat.service';
import {
  ChatInfoDto,
  CreateChatDto,
  DeleteChatDto,
  ListChatsDto,
  SearchChatsDto,
  SendChatMessageDto,
  UpdateChatDto,
} from './dto/ai-chat.dto';

/**
 * AI Chat REST controller. All routes are mounted under `/api/ai/chats` via
 * the global API prefix. The streaming `send` endpoint writes Server-Sent
 * Events directly to the raw Fastify reply (bypasses Nest's response
 * serializer, which would otherwise buffer the stream as JSON).
 */
@UseGuards(JwtAuthGuard)
@Controller('ai/chats')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  async create(@Body() _body: CreateChatDto, @AuthWorkspace() workspace: Workspace, @AuthUser() user: User) {
    return this.aiChatService.createChat(workspace.id, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async list(@Body() body: ListChatsDto | undefined, @AuthWorkspace() workspace: Workspace, @AuthUser() user: User) {
    const limit = Math.min(Math.max(body?.limit ?? 50, 1), 100);
    const items = await this.aiChatService.listChats(workspace.id, user.id, limit);
    return {
      items,
      meta: {
        limit,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
    };
  }

  @Post('info')
  @HttpCode(HttpStatus.OK)
  async info(@Body() body: ChatInfoDto, @AuthWorkspace() workspace: Workspace) {
    const result = await this.aiChatService.getChatInfo(body.chatId, workspace.id);
    return result ?? { chat: null, messages: [] };
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  async delete(@Body() body: DeleteChatDto, @AuthWorkspace() workspace: Workspace) {
    await this.aiChatService.deleteChat(body.chatId, workspace.id);
    return { ok: true };
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  async update(@Body() body: UpdateChatDto, @AuthWorkspace() workspace: Workspace) {
    return this.aiChatService.updateChatTitle(body.chatId, workspace.id, body.title);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() body: SearchChatsDto, @AuthWorkspace() workspace: Workspace, @AuthUser() user: User) {
    return this.aiChatService.searchChats(workspace.id, user.id, body.query);
  }

  /**
   * Streaming chat send. Sets SSE headers and writes chunks until completion.
   * Body shape: { chatId?, content, mentionedPageIds?, contextPageId?, attachmentIds? }
   */
  @Post('send')
  async send(
    @Body() body: SendChatMessageDto,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    res.header('Content-Type', 'text/event-stream; charset=utf-8');
    res.header('Cache-Control', 'no-cache, no-transform');
    res.header('Connection', 'keep-alive');
    res.header('X-Accel-Buffering', 'no');

    // Tear down stream if the client disconnects.
    req.raw.on('close', () => {
      try {
        res.raw.end();
      } catch {
        /* already closed */
      }
    });

    const write = (payload: unknown) => {
      try {
        res.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        /* connection closed mid-stream */
      }
    };

    try {
      await this.aiChatService.sendStream(res.raw, {
        chatId: body.chatId,
        content: body.content,
        workspaceId: workspace.id,
        creatorId: user.id,
        mentionedPageIds: body.mentionedPageIds,
        contextPageId: body.contextPageId,
        attachmentIds: body.attachmentIds,
      });
    } catch (err: any) {
      write({ type: 'error', message: err?.message ?? 'stream failed' });
    } finally {
      try {
        res.raw.end();
      } catch {
        /* already ended */
      }
    }
  }
}

import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { McpService } from './mcp.service';

/**
 * Controller for the Model Context Protocol (MCP) server.
 * Mounts at `/mcp` (excluded from `/api` global prefix in main.ts).
 */
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  /**
   * Initializes the Server-Sent Events (SSE) stream for an MCP client.
   * Requires Bearer token authentication (API key or session).
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async connect(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const settings = workspace?.settings as any;
    if (!settings?.ai?.mcp) {
      throw new ForbiddenException(
        'MCP is not enabled for this workspace. Enable it in Workspace Settings -> AI -> MCP.',
      );
    }

    res.header('Content-Type', 'text/event-stream; charset=utf-8');
    res.header('Cache-Control', 'no-cache, no-transform');
    res.header('Connection', 'keep-alive');
    res.header('X-Accel-Buffering', 'no');

    await this.mcpService.handleSseConnection(req, res, user, workspace);
  }

  /**
   * Handles JSON-RPC client messages sent to the root `/mcp` endpoint.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handlePost(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    await this.mcpService.handlePostMessage(req, res);
  }

  /**
   * Handles JSON-RPC client messages sent to `/mcp/messages` (standard SSE transport endpoint).
   */
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  async handlePostMessages(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    await this.mcpService.handlePostMessage(req, res);
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PageService } from '../../core/page/services/page.service';
import { SpaceService } from '../../core/space/services/space.service';
import { SearchService } from '../../core/search/search.service';
import { CommentService } from '../../core/comment/comment.service';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './mcp.constants';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private transports = new Map<string, SSEServerTransport>();

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageService: PageService,
    private readonly spaceService: SpaceService,
    private readonly searchService: SearchService,
    private readonly commentService: CommentService,
  ) {}

  public createMcpServer(user: User, workspace: Workspace): McpServer {
    const server = new McpServer({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    });

    this.registerTools(server, user, workspace);
    return server;
  }

  public async handleSseConnection(
    req: FastifyRequest,
    res: FastifyReply,
    user: User,
    workspace: Workspace,
  ): Promise<void> {
    const mcpServer = this.createMcpServer(user, workspace);
    const transport = new SSEServerTransport('/mcp/messages', res.raw);

    const sessionId = transport.sessionId;
    this.transports.set(sessionId, transport);
    this.logger.log(`MCP SSE connection established for user ${user.id} in workspace ${workspace.id} (session: ${sessionId})`);

    transport.onclose = () => {
      this.logger.log(`MCP transport closed for session: ${sessionId}`);
      this.transports.delete(sessionId);
    };

    req.raw.on('close', () => {
      this.logger.log(`MCP client disconnected for session: ${sessionId}`);
      this.transports.delete(sessionId);
      try {
        transport.close();
      } catch {
        /* ignore already closed */
      }
    });

    await mcpServer.connect(transport);
    await transport.start();
  }

  public async handlePostMessage(
    req: FastifyRequest,
    res: FastifyReply,
  ): Promise<void> {
    const query = (req.query as Record<string, string>) || {};
    const sessionId = query.sessionId || (req.headers['mcp-session-id'] as string);

    if (!sessionId || !this.transports.has(sessionId)) {
      this.logger.warn(`MCP post message: session not found: ${sessionId}`);
      res.status(404).send({ error: 'Session not found or expired' });
      return;
    }

    const transport = this.transports.get(sessionId)!;
    await transport.handlePostMessage(req.raw, res.raw, req.body);
  }

  private registerTools(server: McpServer, user: User, workspace: Workspace) {
    const jsonResult = (data: unknown) => ({
      content: [
        {
          type: 'text' as const,
          text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        },
      ],
    });

    const errorResult = (err: any) => ({
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error: ${err?.message || String(err)}`,
        },
      ],
    });

    // 1. get_current_user
    server.tool(
      'get_current_user',
      'Get details of the currently authenticated user and workspace',
      {},
      async () => {
        try {
          return jsonResult({
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
            workspace: {
              id: workspace.id,
              name: workspace.name,
            },
          });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 2. list_spaces
    server.tool(
      'list_spaces',
      'List all available spaces in the workspace',
      {},
      async () => {
        try {
          const spaces = await this.db
            .selectFrom('spaces')
            .selectAll('spaces')
            .where('workspaceId', '=', workspace.id)
            .where('deletedAt', 'is', null)
            .orderBy('name', 'asc')
            .execute();

          return jsonResult({ spaces });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 3. get_space
    server.tool(
      'get_space',
      'Get details for a specific space by ID',
      {
        spaceId: z.string().describe('The ID of the space'),
      },
      async ({ spaceId }) => {
        try {
          const space = await this.db
            .selectFrom('spaces')
            .selectAll()
            .where('id', '=', spaceId)
            .where('workspaceId', '=', workspace.id)
            .where('deletedAt', 'is', null)
            .executeTakeFirst();

          if (!space) throw new NotFoundException('Space not found');
          return jsonResult({ space });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 4. create_space
    server.tool(
      'create_space',
      'Create a new space in the workspace',
      {
        name: z.string().describe('The space name'),
        description: z.string().optional().describe('Description of the space'),
        icon: z.string().optional().describe('Icon identifier or emoji'),
        isPublic: z.boolean().optional().describe('Whether the space is public'),
      },
      async ({ name, description, icon, isPublic }) => {
        try {
          const space = await this.spaceService.createSpace(
            user,
            workspace.id,
            {
              name,
              description: description || '',
              icon: icon || '',
              isPublic: isPublic ?? false,
            } as any,
          );
          return jsonResult({ space });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 5. update_space
    server.tool(
      'update_space',
      'Update an existing space',
      {
        spaceId: z.string().describe('The space ID'),
        name: z.string().optional().describe('New space name'),
        description: z.string().optional().describe('New description'),
        icon: z.string().optional().describe('New icon identifier or emoji'),
      },
      async ({ spaceId, name, description, icon }) => {
        try {
          const updatePayload: any = { spaceId };
          if (name !== undefined) updatePayload.name = name;
          if (description !== undefined) updatePayload.description = description;
          if (icon !== undefined) updatePayload.icon = icon;

          const space = await this.spaceService.updateSpace(updatePayload, workspace.id);
          return jsonResult({ space });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 6. search_pages
    server.tool(
      'search_pages',
      'Search pages across the workspace or within a space',
      {
        query: z.string().describe('The search query text'),
        spaceId: z.string().optional().describe('Optional space ID filter'),
      },
      async ({ query, spaceId }) => {
        try {
          const results = await this.searchService.searchPage(
            { query, spaceId } as any,
            {
              userId: user.id,
              workspaceId: workspace.id,
            },
          );
          return jsonResult(results);
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 7. get_page
    server.tool(
      'get_page',
      'Get full page details including content by page ID or slug',
      {
        pageId: z.string().describe('The page ID or slug'),
      },
      async ({ pageId }) => {
        try {
          const page = await this.db
            .selectFrom('pages')
            .selectAll('pages')
            .where((eb) =>
              eb.and([
                eb.or([eb('id', '=', pageId), eb('slugId', '=', pageId)]),
                eb('workspaceId', '=', workspace.id),
                eb('deletedAt', 'is', null),
              ]),
            )
            .executeTakeFirst();

          if (!page) throw new NotFoundException('Page not found');
          return jsonResult({ page });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 8. list_pages
    server.tool(
      'list_pages',
      'List pages in a space',
      {
        spaceId: z.string().describe('The space ID'),
        limit: z.number().optional().describe('Max pages to return (default 50)'),
      },
      async ({ spaceId, limit }) => {
        try {
          const pages = await this.db
            .selectFrom('pages')
            .select(['id', 'title', 'slugId', 'spaceId', 'parentPageId', 'position', 'createdAt', 'updatedAt'])
            .where('spaceId', '=', spaceId)
            .where('workspaceId', '=', workspace.id)
            .where('deletedAt', 'is', null)
            .orderBy('position', 'asc')
            .limit(limit ?? 50)
            .execute();

          return jsonResult({ pages });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 9. list_child_pages
    server.tool(
      'list_child_pages',
      'List direct subpages of a specific page',
      {
        pageId: z.string().describe('The parent page ID'),
      },
      async ({ pageId }) => {
        try {
          const pages = await this.db
            .selectFrom('pages')
            .select(['id', 'title', 'slugId', 'spaceId', 'parentPageId', 'position', 'createdAt', 'updatedAt'])
            .where('parentPageId', '=', pageId)
            .where('workspaceId', '=', workspace.id)
            .where('deletedAt', 'is', null)
            .orderBy('position', 'asc')
            .execute();

          return jsonResult({ pages });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 10. create_page
    server.tool(
      'create_page',
      'Create a new page in a space with title and markdown content',
      {
        spaceId: z.string().describe('Target space ID'),
        title: z.string().describe('Page title'),
        content: z.string().optional().describe('Markdown or plain text content'),
        parentPageId: z.string().optional().describe('Optional parent page ID'),
      },
      async ({ spaceId, title, content, parentPageId }) => {
        try {
          const page = await this.pageService.create(
            user.id,
            workspace.id,
            {
              spaceId,
              title,
              content: content || '',
              format: 'markdown',
              parentPageId,
            } as any,
          );
          return jsonResult({ page });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 11. update_page
    server.tool(
      'update_page',
      'Update page title and/or markdown content',
      {
        pageId: z.string().describe('The page ID to update'),
        title: z.string().optional().describe('New page title'),
        content: z.string().optional().describe('New markdown content'),
      },
      async ({ pageId, title, content }) => {
        try {
          const existingPage = await this.db
            .selectFrom('pages')
            .selectAll()
            .where('id', '=', pageId)
            .where('workspaceId', '=', workspace.id)
            .where('deletedAt', 'is', null)
            .executeTakeFirst();

          if (!existingPage) throw new NotFoundException('Page not found');

          const updateDto: any = { pageId };
          if (title !== undefined) updateDto.title = title;
          if (content !== undefined) {
            updateDto.content = content;
            updateDto.format = 'markdown';
            updateDto.operation = 'replace';
          }

          const page = await this.pageService.update(existingPage as any, updateDto, user);
          return jsonResult({ page });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 12. duplicate_page
    server.tool(
      'duplicate_page',
      'Duplicate an existing page',
      {
        pageId: z.string().describe('The page ID to duplicate'),
        targetSpaceId: z.string().optional().describe('Target space ID (defaults to current space)'),
      },
      async ({ pageId, targetSpaceId }) => {
        try {
          const page = await this.pageService.findById(pageId, true);
          if (!page || page.workspaceId !== workspace.id) {
            throw new NotFoundException('Page not found');
          }

          const duplicated = await this.pageService.duplicatePage(
            page,
            targetSpaceId,
            user,
          );
          return jsonResult({ page: duplicated });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 13. copy_page_to_space
    server.tool(
      'copy_page_to_space',
      'Copy a page to another space',
      {
        pageId: z.string().describe('The page ID to copy'),
        targetSpaceId: z.string().describe('Target space ID'),
      },
      async ({ pageId, targetSpaceId }) => {
        try {
          const page = await this.pageService.findById(pageId, true);
          if (!page || page.workspaceId !== workspace.id) {
            throw new NotFoundException('Page not found');
          }

          const copied = await this.pageService.duplicatePage(
            page,
            targetSpaceId,
            user,
          );
          return jsonResult({ page: copied });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 14. move_page
    server.tool(
      'move_page',
      'Move a page under a new parent or reorder position',
      {
        pageId: z.string().describe('The page ID to move'),
        parentPageId: z.string().optional().describe('New parent page ID or null for root'),
      },
      async ({ pageId, parentPageId }) => {
        try {
          const page = await this.pageService.findById(pageId);
          if (!page || page.workspaceId !== workspace.id) {
            throw new NotFoundException('Page not found');
          }

          const position = await this.pageService.nextPagePosition(page.spaceId, parentPageId);
          const moved = await this.pageService.movePage(
            { pageId, position, parentPageId: parentPageId ?? null },
            page,
          );
          return jsonResult({ page: moved });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 15. move_page_to_space
    server.tool(
      'move_page_to_space',
      'Move a page and its subpages to a different space',
      {
        pageId: z.string().describe('The page ID to move'),
        targetSpaceId: z.string().describe('Target space ID'),
      },
      async ({ pageId, targetSpaceId }) => {
        try {
          const page = await this.pageService.findById(pageId);
          if (!page || page.workspaceId !== workspace.id) {
            throw new NotFoundException('Page not found');
          }

          const moved = await this.pageService.movePageToSpace(page, targetSpaceId, user.id);
          return jsonResult({ success: true, moved });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 16. get_comments
    server.tool(
      'get_comments',
      'Get comments for a specific page',
      {
        pageId: z.string().describe('The page ID'),
      },
      async ({ pageId }) => {
        try {
          const comments = await this.commentService.findByPageId(pageId, {
            page: 1,
            limit: 50,
          } as any);
          return jsonResult(comments);
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 17. create_comment
    server.tool(
      'create_comment',
      'Add a comment to a page',
      {
        pageId: z.string().describe('The page ID'),
        content: z.string().describe('Comment content'),
      },
      async ({ pageId, content }) => {
        try {
          const page = await this.pageService.findById(pageId);
          if (!page || page.workspaceId !== workspace.id) {
            throw new NotFoundException('Page not found');
          }

          const comment = await this.commentService.create(
            { page, workspaceId: workspace.id, user },
            {
              pageId,
              content: JSON.stringify({
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
              }),
              type: 'page',
            } as any,
          );
          return jsonResult({ comment });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 18. update_comment
    server.tool(
      'update_comment',
      'Update an existing comment',
      {
        commentId: z.string().describe('The comment ID'),
        content: z.string().describe('Updated comment text'),
      },
      async ({ commentId, content }) => {
        try {
          const existingComment = await this.commentService.findById(commentId);
          if (!existingComment || (existingComment as any).workspaceId !== workspace.id) {
            throw new NotFoundException('Comment not found');
          }

          const comment = await this.commentService.update(
            existingComment as any,
            {
              content: JSON.stringify({
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
              }),
            } as any,
            user,
          );
          return jsonResult({ comment });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 19. search_attachments
    server.tool(
      'search_attachments',
      'Search attachments in the workspace',
      {
        query: z.string().describe('File name search query'),
        spaceId: z.string().optional().describe('Filter by space ID'),
        pageId: z.string().optional().describe('Filter by page ID'),
      },
      async ({ query, spaceId, pageId }) => {
        try {
          let q = this.db
            .selectFrom('attachments')
            .selectAll('attachments')
            .where('deletedAt', 'is', null)
            .where('fileName', 'like', `%${query}%`);

          if (spaceId) q = q.where('spaceId', '=', spaceId);
          if (pageId) q = q.where('pageId', '=', pageId);

          const attachments = await q.limit(30).execute();
          return jsonResult({ attachments });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    // 20. list_workspace_members
    server.tool(
      'list_workspace_members',
      'List members in the workspace',
      {
        limit: z.number().optional().describe('Max number of members'),
      },
      async ({ limit }) => {
        try {
          const members = await this.db
            .selectFrom('users')
            .select(['id', 'name', 'email', 'avatarUrl', 'role', 'createdAt'])
            .where('workspaceId', '=', workspace.id)
            .where('deletedAt', 'is', null)
            .limit(limit ?? 50)
            .execute();

          return jsonResult({ members });
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }
}

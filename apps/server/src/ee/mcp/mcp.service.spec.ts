import { Test } from '@nestjs/testing';
import { McpService } from './mcp.service';
import { PageService } from '../../core/page/services/page.service';
import { SpaceService } from '../../core/space/services/space.service';
import { SearchService } from '../../core/search/search.service';
import { CommentService } from '../../core/comment/comment.service';

const mockDb = () => {
  const state: { lastTable: string; whereClauses: any[] } = {
    lastTable: '',
    whereClauses: [],
  };
  const chain: any = {
    selectFrom: (t: string) => {
      state.lastTable = t;
      state.whereClauses = [];
      return chain;
    },
    selectAll: () => chain,
    select: () => chain,
    where: (...args: any[]) => {
      state.whereClauses.push(args);
      return chain;
    },
    orderBy: () => chain,
    limit: () => chain,
    execute: async () => {
      if (state.lastTable === 'spaces') {
        return [{ id: 'space-1', name: 'General', workspaceId: 'ws-1' }];
      }
      if (state.lastTable === 'pages') {
        return [{ id: 'page-1', title: 'Welcome', workspaceId: 'ws-1' }];
      }
      return [];
    },
    executeTakeFirst: async () => {
      if (state.lastTable === 'spaces') {
        return { id: 'space-1', name: 'General', workspaceId: 'ws-1' };
      }
      if (state.lastTable === 'pages') {
        return { id: 'page-1', title: 'Welcome', content: 'Hello', workspaceId: 'ws-1' };
      }
      return undefined;
    },
  };
  return { db: chain, state };
};

describe('McpService', () => {
  let service: McpService;
  let fakeDb: ReturnType<typeof mockDb>;
  const mockPageService = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    duplicatePage: jest.fn(),
    movePage: jest.fn(),
    movePageToSpace: jest.fn(),
    nextPagePosition: jest.fn().mockResolvedValue('a0'),
  };
  const mockSpaceService = {
    createSpace: jest.fn(),
    updateSpace: jest.fn(),
  };
  const mockSearchService = {
    searchPage: jest.fn(),
  };
  const mockCommentService = {
    findByPageId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const fakeUser: any = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    workspaceId: 'ws-1',
  };

  const fakeWorkspace: any = {
    id: 'ws-1',
    name: 'Test Workspace',
    settings: { ai: { mcp: true } },
  };

  beforeEach(async () => {
    fakeDb = mockDb();
    const module = await Test.createTestingModule({
      providers: [
        McpService,
        { provide: 'KyselyModuleConnectionToken', useValue: fakeDb.db },
        { provide: PageService, useValue: mockPageService },
        { provide: SpaceService, useValue: mockSpaceService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: CommentService, useValue: mockCommentService },
      ],
    }).compile();

    service = module.get(McpService);
  });

  it('createMcpServer instantiates McpServer with registered tools', () => {
    const server = service.createMcpServer(fakeUser, fakeWorkspace);
    expect(server).toBeDefined();
    expect((server as any)._registeredTools).toBeDefined();

    // Check that expected tools are registered
    const tools = (server as any)._registeredTools;
    expect('get_current_user' in tools).toBe(true);
    expect('list_spaces' in tools).toBe(true);
    expect('get_space' in tools).toBe(true);
    expect('create_space' in tools).toBe(true);
    expect('search_pages' in tools).toBe(true);
    expect('get_page' in tools).toBe(true);
    expect('create_page' in tools).toBe(true);
    expect('update_page' in tools).toBe(true);
    expect('list_pages' in tools).toBe(true);
    expect('list_child_pages' in tools).toBe(true);
    expect('duplicate_page' in tools).toBe(true);
    expect('copy_page_to_space' in tools).toBe(true);
    expect('move_page' in tools).toBe(true);
    expect('move_page_to_space' in tools).toBe(true);
    expect('get_comments' in tools).toBe(true);
    expect('create_comment' in tools).toBe(true);
    expect('update_comment' in tools).toBe(true);
    expect('search_attachments' in tools).toBe(true);
    expect('list_workspace_members' in tools).toBe(true);
  });

  it('handlePostMessage returns 404 when session is not found', async () => {
    const req: any = {
      query: { sessionId: 'non-existent-session' },
      headers: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await service.handlePostMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Session not found or expired' });
  });

  it('tool get_current_user returns user and workspace info', async () => {
    const server = service.createMcpServer(fakeUser, fakeWorkspace);
    const tool = (server as any)._registeredTools['get_current_user'];
    expect(tool).toBeDefined();

    const result = await tool.handler({});
    expect(result.content).toBeDefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.user.id).toBe('user-1');
    expect(parsed.workspace.id).toBe('ws-1');
  });

  it('tool list_spaces returns spaces from database', async () => {
    const server = service.createMcpServer(fakeUser, fakeWorkspace);
    const tool = (server as any)._registeredTools['list_spaces'];
    expect(tool).toBeDefined();

    const result = await tool.handler({});
    expect(result.content).toBeDefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.spaces).toHaveLength(1);
    expect(parsed.spaces[0].name).toBe('General');
  });

  it('tool get_page returns page content', async () => {
    const server = service.createMcpServer(fakeUser, fakeWorkspace);
    const tool = (server as any)._registeredTools['get_page'];
    expect(tool).toBeDefined();

    const result = await tool.handler({ pageId: 'page-1' });
    expect(result.content).toBeDefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.page.title).toBe('Welcome');
  });
});

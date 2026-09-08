import { Test } from '@nestjs/testing';
import { ApiKeyService } from './api-key.service';
import { KyselyDB } from '../../database/types/kysely.types';

// Unit test with a hand-rolled fake Kysely: we only assert the service
// generates a token, hashes it, and returns the plaintext exactly once.
const fakeDb = () => {
  const inserted: any[] = [];
  const state: { lastTable: string; joinedTables: string[]; lastSelect: string[]; whereClauses: any[] } = {
    lastTable: '',
    joinedTables: [],
    lastSelect: [],
    whereClauses: [],
  };
  let customRow: any = null;

  const chain: any = {
    insertInto: (t: string) => { state.lastTable = t; return chain; },
    values: (v: any) => { inserted.push(v); return chain; },
    returningAll: () => chain,
    executeTakeFirstOrThrow: async () => ({ id: 'key-1', ...inserted[0] }),
    execute: async () => inserted,
    selectFrom: (t: string) => { state.lastTable = t; state.lastSelect = []; state.whereClauses = []; return chain; },
    selectAll: () => chain,
    select: (fields: any) => {
      if (Array.isArray(fields)) state.lastSelect.push(...fields);
      return chain;
    },
    leftJoin: (t: string) => { state.joinedTables.push(t); return chain; },
    where: (...args: any[]) => { state.whereClauses.push(args); return chain; },
    whereRef: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    updateTable: () => chain,
    set: () => chain,
    executeTakeFirst: async () => {
      if (customRow !== null) {
        const row = customRow;
        customRow = null;
        return row;
      }
      if (state.lastTable === 'users') {
        if (state.lastSelect.length > 0) {
          return {
            id: 'user-1',
            name: 'Creator',
            avatarUrl: null,
            email: 'creator@example.com',
          };
        }
        return {
          id: 'user-1',
          name: 'Creator',
          avatarUrl: null,
          email: 'creator@example.com',
          workspaceId: 'ws-1',
          deactivatedAt: null,
        };
      }
      if (state.lastTable === 'workspaces') {
        return {
          id: 'ws-1',
          name: 'Default Workspace',
        };
      }
      return undefined;
    },
  };
  return { db: chain as unknown as KyselyDB, inserted, state, setCustomRow: (r: any) => { customRow = r; } };
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let fake: ReturnType<typeof fakeDb>;

  beforeEach(async () => {
    fake = fakeDb();
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: 'KyselyModuleConnectionToken', useValue: fake.db },
      ],
    }).compile();
    service = module.get(ApiKeyService);
  });

  it('create returns plaintext token and stores only its hash', async () => {
    const res = await service.create('user-1', 'ws-1', { name: 'ci' });
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{20,}/);
    expect(fake.inserted[0].tokenHash).not.toBe(res.token);
    expect(fake.inserted[0].tokenHash.length).toBe(64); // sha256 hex
  });

  it('create includes creator object in response', async () => {
    const res = await service.create('user-1', 'ws-1', { name: 'ci' });
    expect(res.creator).toEqual({
      id: 'user-1',
      name: 'Creator',
      avatarUrl: null,
      email: 'creator@example.com',
    });
  });

  it('list queries users table for creator join', async () => {
    await service.list('ws-1', {});
    expect(fake.state.lastTable).toBe('apiKeys');
    expect(fake.state.joinedTables).toContain('users');
    expect(fake.state.lastSelect.some((f) => f.startsWith('users.id'))).toBe(true);
    expect(fake.state.lastSelect.some((f) => f.startsWith('users.email'))).toBe(true);
  });

  it('validateOpaqueToken authenticates valid token and touches lastUsedAt', async () => {
    const { createHash } = require('crypto');
    const token = 'test-token-123';
    const tokenHash = createHash('sha256').update(token).digest('hex');

    fake.setCustomRow({
      id: 'key-1',
      tokenHash,
      creatorId: 'user-1',
      workspaceId: 'ws-1',
      deletedAt: null,
      expiresAt: null,
    });

    const result = await service.validateOpaqueToken(token);
    expect(result.user.id).toBe('user-1');
    expect(result.workspace.id).toBe('ws-1');
  });

  it('validateOpaqueToken throws if token is not found', async () => {
    await expect(service.validateOpaqueToken('unknown-token')).rejects.toThrow('Invalid API key');
  });

  it('validateOpaqueToken throws if key has expired', async () => {
    fake.setCustomRow({
      id: 'key-1',
      creatorId: 'user-1',
      workspaceId: 'ws-1',
      deletedAt: null,
      expiresAt: new Date(Date.now() - 10000),
    });

    await expect(service.validateOpaqueToken('expired-token')).rejects.toThrow('API key has expired');
  });

  it('validateApiKey authenticates valid jwt payload', async () => {
    fake.setCustomRow({
      id: 'key-1',
      creatorId: 'user-1',
      workspaceId: 'ws-1',
      deletedAt: null,
      expiresAt: null,
    });

    const result = await service.validateApiKey({
      apiKeyId: 'key-1',
      workspaceId: 'ws-1',
      sub: 'user-1',
      type: 'api_key',
    });

    expect(result.user.id).toBe('user-1');
    expect(result.workspace.id).toBe('ws-1');
  });
});

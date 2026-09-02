import { Test } from '@nestjs/testing';
import { ScimTokenService } from './scim.service';
import { KyselyDB } from '../../database/types/kysely.types';

// Unit test with a hand-rolled fake Kysely: we only assert the service
// generates a token, hashes it, and returns the plaintext exactly once.
const fakeDb = () => {
  const inserted: any[] = [];
  const state: { lastTable: string; joinedTables: string[]; lastSelect: string[] } = {
    lastTable: '',
    joinedTables: [],
    lastSelect: [],
  };
  const chain: any = {
    insertInto: (t: string) => { state.lastTable = t; return chain; },
    values: (v: any) => { inserted.push(v); return chain; },
    returningAll: () => chain,
    executeTakeFirstOrThrow: async () => ({ id: 'scim-1', ...inserted[0] }),
    execute: async () => inserted,
    selectFrom: (t: string) => { state.lastTable = t; state.lastSelect = []; return chain; },
    selectAll: () => chain,
    select: (fields: any) => {
      if (Array.isArray(fields)) state.lastSelect.push(...fields);
      return chain;
    },
    leftJoin: (t: string) => { state.joinedTables.push(t); return chain; },
    where: () => chain,
    whereRef: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    updateTable: () => chain,
    set: () => chain,
    executeTakeFirst: async () => {
      if (state.lastTable === 'users') {
        return {
          id: 'user-1',
          name: 'Creator',
          avatarUrl: null,
          email: 'creator@example.com',
        };
      }
      return undefined;
    },
  };
  return { db: chain as unknown as KyselyDB, inserted, state };
};

describe('ScimTokenService', () => {
  let service: ScimTokenService;
  let fake: ReturnType<typeof fakeDb>;

  beforeEach(async () => {
    fake = fakeDb();
    const module = await Test.createTestingModule({
      providers: [
        ScimTokenService,
        { provide: 'KyselyModuleConnectionToken', useValue: fake.db },
      ],
    }).compile();
    service = module.get(ScimTokenService);
  });

  it('create stores hash + last four and returns plaintext once', async () => {
    const res = await service.create('user-1', 'ws-1', { name: 'okta' });
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{20,}/);
    expect(res.tokenLastFour).toBe(res.token.slice(-4));
    expect(fake.inserted[0].tokenHash).not.toBe(res.token);
    expect(fake.inserted[0].tokenHash.length).toBe(64); // sha256 hex
  });

  it('create includes creator object in response', async () => {
    const res = await service.create('user-1', 'ws-1', { name: 'okta' });
    expect(res.creator).toEqual({
      id: 'user-1',
      name: 'Creator',
      avatarUrl: null,
      email: 'creator@example.com',
    });
  });

  it('list queries users table for creator join', async () => {
    await service.list('ws-1', {});
    expect(fake.state.lastTable).toBe('scimTokens');
    expect(fake.state.joinedTables).toContain('users');
    expect(fake.state.lastSelect.some((f) => f.startsWith('users.id'))).toBe(true);
    expect(fake.state.lastSelect.some((f) => f.startsWith('users.email'))).toBe(true);
  });
});

import { Test } from '@nestjs/testing';
import { ApiKeyService } from './api-key.service';
import { KyselyDB } from '../../database/types/kysely.types';

// Unit test with a hand-rolled fake Kysely: we only assert the service
// generates a token, hashes it, and returns the plaintext exactly once.
const fakeDb = () => {
  const inserted: any[] = [];
  const chain: any = {
    insertInto: (t: string) => { chain._t = t; return chain; },
    values: (v: any) => { inserted.push(v); return chain; },
    returningAll: () => chain,
    executeTakeFirstOrThrow: async () => ({ id: 'key-1', ...inserted[0] }),
    execute: async () => inserted,
    selectFrom: () => chain,
    selectAll: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    updateTable: () => chain,
    set: () => chain,
    executeTakeFirst: async () => undefined,
  };
  return { db: chain as unknown as KyselyDB, inserted };
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
});

import { Test } from '@nestjs/testing';
import { SsoService } from './sso.service';
import { KyselyDB } from '../../database/types/kysely.types';
import { EncryptionService } from '../../integrations/encryption/encryption.service';

const fakeDb = () => {
  const inserted: any[] = [];
  const chain: any = {
    insertInto: () => chain,
    values: (v: any) => {
      inserted.push(v);
      return chain;
    },
    returningAll: () => chain,
    executeTakeFirstOrThrow: async () => ({ id: 'prov-1', ...inserted[0] }),
    execute: async () => inserted,
    selectFrom: () => chain,
    selectAll: () => chain,
    select: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    updateTable: () => chain,
    set: () => chain,
    executeTakeFirst: async () => undefined,
  };
  return { db: chain as unknown as KyselyDB, inserted };
};

// Minimal EncryptionService double: reversible marker so we can assert the
// stored value is not the plaintext but round-trips.
const fakeEncryption = {
  encrypt: (s: string) => `enc::${Buffer.from(s).toString('base64')}`,
  decrypt: (s: string) => {
    if (!s.startsWith('enc::')) throw new Error('bad');
    return Buffer.from(s.slice(5), 'base64').toString();
  },
};

describe('SsoService', () => {
  let service: SsoService;
  let fake: ReturnType<typeof fakeDb>;

  beforeEach(async () => {
    fake = fakeDb();
    const module = await Test.createTestingModule({
      providers: [
        SsoService,
        { provide: 'KyselyModuleConnectionToken', useValue: fake.db },
        { provide: EncryptionService, useValue: fakeEncryption },
      ],
    }).compile();
    service = module.get(SsoService);
  });

  it('create encrypts oidc client secret before insert', async () => {
    await service.create('user-1', 'ws-1', {
      name: 'Okta',
      type: 'oidc',
      oidcIssuer: 'https://x',
      oidcClientId: 'cid',
      oidcClientSecret: 'topsecret',
      allowSignup: false,
      isEnabled: false,
    } as any);
    expect(fake.inserted[0].oidcClientSecret).not.toContain('topsecret');
    expect(fake.inserted[0].oidcClientSecret).toMatch(/^enc::/);
  });

  it('returned provider decrypts secrets back to plaintext', async () => {
    const res = await service.create('user-1', 'ws-1', {
      name: 'Okta',
      type: 'oidc',
      oidcClientSecret: 'topsecret',
    } as any);
    expect(res.oidcClientSecret).toBe('topsecret');
  });

  it('list does not crash and returns pagination envelope', async () => {
    // fake chain returns inserted (empty) for execute
    const page = await service.list('ws-1');
    expect(page).toHaveProperty('items');
    expect(page.meta).toHaveProperty('hasNextPage', false);
  });
});

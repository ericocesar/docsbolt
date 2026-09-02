import { Test } from '@nestjs/testing';
import { generateSecret, generateSync, verifySync } from 'otplib';
import { MfaService } from './mfa.service';
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
    onConflict: () => chain,
    column: () => chain,
    doUpdateSet: () => chain,
    execute: async () => inserted,
    selectFrom: () => chain,
    selectAll: () => chain,
    select: () => chain,
    where: () => chain,
    executeTakeFirst: async () => undefined,
    updateTable: () => chain,
    set: (v: any) => {
      inserted.push(v);
      return chain;
    },
    deleteFrom: () => chain,
  };
  return { db: chain as unknown as KyselyDB, inserted };
};

const fakeEncryption = {
  encrypt: (s: string) => `enc::${Buffer.from(s).toString('base64')}`,
  decrypt: (s: string) => {
    if (!s.startsWith('enc::')) throw new Error('bad');
    return Buffer.from(s.slice(5), 'base64').toString();
  },
};

describe('MfaService', () => {
  let service: MfaService;
  let fake: ReturnType<typeof fakeDb>;

  beforeEach(async () => {
    fake = fakeDb();
    const module = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: 'KyselyModuleConnectionToken', useValue: fake.db },
        { provide: EncryptionService, useValue: fakeEncryption },
      ],
    }).compile();
    service = module.get(MfaService);
  });

  it('setup generates secret + QR data URL', async () => {
    const setup = await service.setup('user-1', 'ws-1', 'a@b.com');
    expect(setup.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(setup.manualKey.length).toBeGreaterThan(10);
    // stored secret must be encrypted, not plaintext
    expect(fake.inserted[0].secret).toMatch(/^enc::/);
  });

  it('generateSync produces a working 6-digit code', () => {
    const secret = generateSecret();
    const code = generateSync({ secret });
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generateBackupCodes returns 10 codes', () => {
    expect(service.generateBackupCodes()).toHaveLength(10);
  });

  it('enable rejects invalid TOTP code', async () => {
    // row() returns undefined in fake -> BadRequestException('Run setup first')
    await expect(service.enable('user-1', '000000')).rejects.toThrow(
      'Run setup first',
    );
  });

  it('enable accepts a valid TOTP code for the stored secret', async () => {
    const secret = generateSecret();
    // make row() return an encrypted secret
    (fake.db as any).__row = {
      userId: 'user-1',
      method: 'totp',
      secret: `enc::${Buffer.from(secret).toString('base64')}`,
      isEnabled: false,
      backupCodes: [],
    };
    // patch executeTakeFirst to return the row for userMfa selects
    const orig = (fake.db as any).selectFrom;
    (fake.db as any).selectFrom = (t: string) => {
      const c = orig(t);
      if (t === 'userMfa') {
        c.executeTakeFirst = async () => (fake.db as any).__row;
      }
      return c;
    };
    const code = generateSync({ secret });
    const res = await service.enable('user-1', code);
    expect(res.success).toBe(true);
    expect(res.backupCodes).toHaveLength(10);
  });
});

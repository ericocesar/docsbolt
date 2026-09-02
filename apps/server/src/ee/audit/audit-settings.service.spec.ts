import { Test } from '@nestjs/testing';
import { AuditSettingsService } from './audit-settings.service';
import { KyselyDB } from '../../database/types/kysely.types';

const fakeDb = () => {
  const inserted: any[] = [];
  const chain: any = {
    selectFrom: () => chain,
    select: () => chain,
    where: () => chain,
    executeTakeFirst: async () => ({ auditRetentionDays: 90 }),
    updateTable: () => chain,
    set: (v: any) => {
      inserted.push(v);
      return chain;
    },
    execute: async () => inserted,
  };
  return { db: chain as unknown as KyselyDB, inserted };
};

describe('AuditSettingsService', () => {
  let service: AuditSettingsService;
  let fake: ReturnType<typeof fakeDb>;

  beforeEach(async () => {
    fake = fakeDb();
    const module = await Test.createTestingModule({
      providers: [
        AuditSettingsService,
        { provide: 'KyselyModuleConnectionToken', useValue: fake.db },
      ],
    }).compile();
    service = module.get(AuditSettingsService);
  });

  it('update writes retentionDays to workspace row', async () => {
    await service.updateRetention('ws-1', 30);
    expect(fake.inserted[0]).toMatchObject({ auditRetentionDays: 30 });
  });

  it('get returns workspace value or 90 default', async () => {
    const r = await service.getRetention('ws-1');
    expect(r.retentionDays).toBe(90);
  });
});

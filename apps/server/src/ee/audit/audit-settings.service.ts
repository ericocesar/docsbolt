import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';

@Injectable()
export class AuditSettingsService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getRetention(workspaceId: string) {
    const ws = await this.db
      .selectFrom('workspaces')
      .select('auditRetentionDays')
      .where('id', '=', workspaceId)
      .executeTakeFirst();
    return { retentionDays: ws?.auditRetentionDays ?? 90 };
  }

  async updateRetention(workspaceId: string, retentionDays: number) {
    await this.db
      .updateTable('workspaces')
      .set({ auditRetentionDays: retentionDays, updatedAt: new Date() })
      .where('id', '=', workspaceId)
      .execute();
    return { retentionDays };
  }
}

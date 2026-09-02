import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { EncryptionService } from '../../integrations/encryption/encryption.service';
import { CreateSsoProviderDto, UpdateSsoProviderDto } from './dto';

const SECRET_FIELDS = [
  'oidcClientSecret',
  'ldapBindPassword',
  'ldapTlsCaCert',
  'samlCertificate',
] as const;

@Injectable()
export class SsoService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly encryption: EncryptionService,
  ) {}

  private encryptSecrets(dto: Partial<CreateSsoProviderDto>) {
    const out: Record<string, unknown> = { ...dto };
    for (const f of SECRET_FIELDS) {
      const v = out[f];
      if (typeof v === 'string' && v.length) {
        out[f] = this.encryption.encrypt(v);
      }
    }
    return out;
  }

  private decryptSecrets(row: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { ...row };
    for (const f of SECRET_FIELDS) {
      if (typeof out[f] === 'string' && out[f]) {
        try {
          out[f] = this.encryption.decrypt(out[f]);
        } catch {
          // leave as-is
        }
      }
    }
    return out;
  }

  async list(workspaceId: string) {
    const items = await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .execute();
    return {
      items: items.map((i) => this.decryptSecrets(i)),
      meta: {
        limit: 50,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
    };
  }

  async info(workspaceId: string) {
    const page = await this.list(workspaceId);
    return page.items[0] ?? null;
  }

  async create(userId: string, workspaceId: string, dto: CreateSsoProviderDto) {
    const row = await this.db
      .insertInto('authProviders')
      .values({
        ...this.encryptSecrets(dto),
        creatorId: userId,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.decryptSecrets(row);
  }

  async update(workspaceId: string, dto: UpdateSsoProviderDto) {
    const { providerId, ...rest } = dto;
    const row = await this.db
      .updateTable('authProviders')
      .set({ ...this.encryptSecrets(rest), updatedAt: new Date() })
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Provider not found');
    return this.decryptSecrets(row);
  }

  async delete(workspaceId: string, providerId: string) {
    const r = await this.db
      .updateTable('authProviders')
      .set({ deletedAt: new Date(), isEnabled: false, updatedAt: new Date() })
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!r) throw new NotFoundException('Provider not found');
  }
}

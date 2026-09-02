import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { createHash, randomBytes } from 'crypto';
import { KyselyDB } from '../../database/types/kysely.types';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';

const PAGE_LIMIT = 50;

@Injectable()
export class ApiKeyService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async list(workspaceId: string, params: { cursor?: string; limit?: number }) {
    const limit = Math.min(params.limit ?? PAGE_LIMIT, PAGE_LIMIT);
    let q = this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);
    if (params.cursor) q = q.where('createdAt', '<', params.cursor as any);

    const rows = await q.execute();
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items,
      meta: {
        limit,
        hasNextPage,
        hasPrevPage: !!params.cursor,
        nextCursor: hasNextPage ? (items[items.length - 1] as any).createdAt : null,
        prevCursor: params.cursor ?? null,
      },
    };
  }

  async create(userId: string, workspaceId: string, dto: CreateApiKeyDto) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const row = await this.db
      .insertInto('apiKeys')
      .values({
        name: dto.name,
        creatorId: userId,
        workspaceId,
        tokenHash,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...row, token };
  }

  async update(userId: string, workspaceId: string, dto: UpdateApiKeyDto) {
    const row = await this.db
      .updateTable('apiKeys')
      .set({ name: dto.name, updatedAt: new Date() })
      .where('id', '=', dto.apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('API key not found');
    return row;
  }

  async revoke(workspaceId: string, apiKeyId: string) {
    const updated = await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    if (!updated) throw new NotFoundException('API key not found');
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { createHash, randomBytes } from 'crypto';
import { KyselyDB } from '../../database/types/kysely.types';
import { CreateScimTokenDto, UpdateScimTokenDto } from './dto';

const PAGE_LIMIT = 50;

const CREATOR_FIELDS = ['users.id', 'users.name', 'users.avatarUrl', 'users.email'] as const;

@Injectable()
export class ScimTokenService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private findCreator(creatorId: string) {
    return this.db
      .selectFrom('users')
      .select([...CREATOR_FIELDS])
      .where('users.id', '=', creatorId)
      .executeTakeFirst();
  }

  private withCreator<T extends { creatorId: string }>(row: T, creator?: { id: string; name: string | null; avatarUrl: string | null; email: string }) {
    return { ...row, creator: creator ?? null };
  }

  async list(workspaceId: string, params: { cursor?: string; limit?: number }) {
    const limit = Math.min(params.limit ?? PAGE_LIMIT, PAGE_LIMIT);
    let q = this.db
      .selectFrom('scimTokens')
      .selectAll('scimTokens')
      .leftJoin('users', 'users.id', 'scimTokens.creatorId')
      .select([
        'users.id as creatorUserId',
        'users.name as creatorUserName',
        'users.avatarUrl as creatorUserAvatarUrl',
        'users.email as creatorUserEmail',
      ])
      .where('scimTokens.workspaceId', '=', workspaceId)
      .where('scimTokens.deletedAt', 'is', null)
      .orderBy('scimTokens.createdAt', 'desc')
      .limit(limit + 1);
    if (params.cursor) q = q.where('scimTokens.createdAt', '<', params.cursor as any);

    const rows = await q.execute();
    const mapped = rows.map((row: any) => {
      const {
        creatorUserId,
        creatorUserName,
        creatorUserAvatarUrl,
        creatorUserEmail,
        ...item
      } = row;
      return {
        ...item,
        creator: creatorUserId
          ? {
              id: creatorUserId,
              name: creatorUserName,
              avatarUrl: creatorUserAvatarUrl,
              email: creatorUserEmail,
            }
          : null,
      };
    });
    const hasNextPage = mapped.length > limit;
    const items = hasNextPage ? mapped.slice(0, limit) : mapped;
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

  async create(userId: string, workspaceId: string, dto: CreateScimTokenDto) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const row = await this.db
      .insertInto('scimTokens')
      .values({
        name: dto.name,
        tokenHash,
        tokenLastFour: token.slice(-4),
        isEnabled: true,
        creatorId: userId,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();

    const creator = await this.findCreator(row.creatorId);
    return { ...this.withCreator(row, creator), token };
  }

  async update(userId: string, workspaceId: string, dto: UpdateScimTokenDto) {
    const row = await this.db
      .updateTable('scimTokens')
      .set({
        name: dto.name,
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        updatedAt: new Date(),
      } as any)
      .where('id', '=', dto.tokenId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('SCIM token not found');
    const creator = await this.findCreator(row.creatorId);
    return this.withCreator(row, creator);
  }

  async revoke(workspaceId: string, tokenId: string) {
    const updated = await this.db
      .updateTable('scimTokens')
      .set({ deletedAt: new Date(), isEnabled: false, updatedAt: new Date() })
      .where('id', '=', tokenId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    if (!updated) throw new NotFoundException('SCIM token not found');
  }
}

import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { createHash, randomBytes } from 'crypto';
import { KyselyDB } from '../../database/types/kysely.types';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { JwtApiKeyPayload } from '../../core/auth/dto/jwt-payload';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { isUserDisabled } from '../../common/helpers';

const PAGE_LIMIT = 50;

const CREATOR_FIELDS = ['users.id', 'users.name', 'users.avatarUrl', 'users.email'] as const;

@Injectable()
export class ApiKeyService {
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
      .selectFrom('apiKeys')
      .selectAll('apiKeys')
      .leftJoin('users', 'users.id', 'apiKeys.creatorId')
      .select([
        'users.id as creatorUserId',
        'users.name as creatorUserName',
        'users.avatarUrl as creatorUserAvatarUrl',
        'users.email as creatorUserEmail',
      ])
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null)
      .orderBy('apiKeys.createdAt', 'desc')
      .limit(limit + 1);
    if (params.cursor) q = q.where('apiKeys.createdAt', '<', params.cursor as any);

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

    const creator = await this.findCreator(row.creatorId);
    return { ...this.withCreator(row, creator), token };
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
    const creator = await this.findCreator(row.creatorId);
    return this.withCreator(row, creator);
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

  async validateOpaqueToken(token: string): Promise<{ user: User; workspace: Workspace }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const key = await this.db
      .selectFrom('apiKeys')
      .selectAll('apiKeys')
      .where('tokenHash', '=', tokenHash)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', key.id)
      .execute();

    const workspace = await this.db
      .selectFrom('workspaces')
      .selectAll('workspaces')
      .where('id', '=', key.workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new UnauthorizedException('Workspace not found');
    }

    const user = await this.db
      .selectFrom('users')
      .selectAll('users')
      .where('id', '=', key.creatorId)
      .where('workspaceId', '=', key.workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException('User not found or disabled');
    }

    return {
      user: user as unknown as User,
      workspace: workspace as unknown as Workspace,
    };
  }

  async validateApiKey(payload: JwtApiKeyPayload): Promise<{ user: User; workspace: Workspace }> {
    const key = await this.db
      .selectFrom('apiKeys')
      .selectAll('apiKeys')
      .where('id', '=', payload.apiKeyId)
      .where('workspaceId', '=', payload.workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', key.id)
      .execute();

    const workspace = await this.db
      .selectFrom('workspaces')
      .selectAll('workspaces')
      .where('id', '=', payload.workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      throw new UnauthorizedException('Workspace not found');
    }

    const user = await this.db
      .selectFrom('users')
      .selectAll('users')
      .where('id', '=', key.creatorId)
      .where('workspaceId', '=', payload.workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException('User not found or disabled');
    }

    return {
      user: user as unknown as User,
      workspace: workspace as unknown as Workspace,
    };
  }
}


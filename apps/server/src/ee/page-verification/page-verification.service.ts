import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import {
  PageIdDto,
  RejectApprovalDto,
  SetupVerificationDto,
  UpdateVerificationDto,
} from './dto';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

const PAGE_LIMIT = 50;

type UserRef = { id: string; name: string | null; avatarUrl: string | null };

@Injectable()
export class PageVerificationService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private computeExpiresAt(
    mode?: string,
    periodAmount?: number,
    periodUnit?: string,
    fixedExpiresAt?: string,
  ): Date | null {
    if (mode === 'fixed' && fixedExpiresAt) return new Date(fixedExpiresAt);
    if (mode === 'period' && periodAmount && periodUnit) {
      const d = new Date();
      const n = periodAmount;
      if (periodUnit === 'day') d.setDate(d.getDate() + n);
      else if (periodUnit === 'week') d.setDate(d.getDate() + n * 7);
      else if (periodUnit === 'month') d.setMonth(d.getMonth() + n);
      else if (periodUnit === 'year') d.setFullYear(d.getFullYear() + n);
      return d;
    }
    return null;
  }

  private async getPage(workspaceId: string, pageId: string) {
    const page = await this.db
      .selectFrom('pages')
      .select(['id', 'spaceId', 'workspaceId', 'deletedAt'])
      .where('id', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!page || page.deletedAt) throw new NotFoundException('Page not found');
    return page;
  }

  private async replaceVerifiers(
    verificationId: string,
    verifierIds: string[],
    addedById: string,
  ) {
    await this.db
      .deleteFrom('pageVerifiers')
      .where('pageVerificationId', '=', verificationId)
      .execute();
    if (verifierIds.length) {
      await this.db
        .insertInto('pageVerifiers')
        .values(
          verifierIds.map((userId) => ({
            pageVerificationId: verificationId,
            userId,
            isPrimary: false,
            addedById,
            createdAt: new Date(),
          })),
        )
        .execute();
    }
  }

  private async verifierRefs(verificationId: string) {
    return this.db
      .selectFrom('pageVerifiers')
      .innerJoin('users', 'users.id', 'pageVerifiers.userId')
      .select([
        'users.id',
        'users.name',
        'users.avatarUrl',
        'users.email',
      ])
      .where('pageVerifiers.pageVerificationId', '=', verificationId)
      .execute();
  }

  private permissions(canManage: boolean) {
    return {
      canVerify: canManage,
      canManage,
      canSubmitForApproval: canManage,
      canMarkObsolete: canManage,
    };
  }

  private canManagePage(userRole: string | undefined, creatorId: string | null, userId: string) {
    return userRole === 'admin' || creatorId === userId;
  }

  async info(workspaceId: string, userId: string, pageId: string) {
    await this.getPage(workspaceId, pageId);

    const row = await this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!row) return { status: 'none' as const, permissions: this.permissions(true) };

    const verifiers = await this.verifierRefs(row.id);
    const page = await this.db
      .selectFrom('pages')
      .select(['creatorId'])
      .where('id', '=', pageId)
      .executeTakeFirst();

    return {
      id: row.id,
      pageId: row.pageId,
      type: row.type,
      mode: row.mode,
      periodAmount: row.periodAmount,
      periodUnit: row.periodUnit,
      status: row.status ?? 'none',
      verifiedAt: row.verifiedAt,
      expiresAt: row.expiresAt,
      requestedAt: row.requestedAt,
      rejectedAt: row.rejectedAt,
      rejectionComment: row.rejectionComment,
      verifiers: verifiers.map((v) => ({
        id: v.id,
        name: v.name,
        avatarUrl: v.avatarUrl,
        email: v.email,
      })),
      permissions: this.permissions(
        this.canManagePage('admin', page?.creatorId ?? null, userId),
      ),
    };
  }

  async create(userId: string, workspaceId: string, dto: SetupVerificationDto) {
    const page = await this.getPage(workspaceId, dto.pageId);

    const existing = await this.db
      .selectFrom('pageVerifications')
      .select('id')
      .where('pageId', '=', dto.pageId)
      .executeTakeFirst();

    let verificationId: string;
    if (existing) {
      await this.db
        .updateTable('pageVerifications')
        .set({
          type: dto.type ?? 'expiring',
          mode: dto.mode,
          periodAmount: dto.periodAmount,
          periodUnit: dto.periodUnit,
          expiresAt: this.computeExpiresAt(
            dto.mode, dto.periodAmount, dto.periodUnit, dto.fixedExpiresAt,
          ),
          updatedAt: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();
      verificationId = existing.id;
    } else {
      const created = await this.db
        .insertInto('pageVerifications')
        .values({
          pageId: dto.pageId,
          workspaceId,
          spaceId: page.spaceId,
          type: dto.type ?? 'expiring',
          status: 'draft',
          mode: dto.mode,
          periodAmount: dto.periodAmount,
          periodUnit: dto.periodUnit,
          expiresAt: this.computeExpiresAt(
            dto.mode, dto.periodAmount, dto.periodUnit, dto.fixedExpiresAt,
          ),
          creatorId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning('id')
        .executeTakeFirstOrThrow();
      verificationId = created.id;
    }

    await this.replaceVerifiers(verificationId, dto.verifierIds ?? [], userId);
    return this.info(workspaceId, userId, dto.pageId);
  }

  async update(userId: string, workspaceId: string, dto: UpdateVerificationDto) {
    return this.create(userId, workspaceId, dto);
  }

  async remove(workspaceId: string, pageId: string) {
    await this.getPage(workspaceId, pageId);
    // page_verifiers cascades on verification delete
    await this.db
      .deleteFrom('pageVerifications')
      .where('pageId', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async verify(workspaceId: string, userId: string, pageId: string) {
    const row = await this.db
      .selectFrom('pageVerifications')
      .select(['id', 'mode', 'periodAmount', 'periodUnit'])
      .where('pageId', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Verification not found');

    await this.db
      .updateTable('pageVerifications')
      .set({
        status: 'verified',
        verifiedAt: new Date(),
        verifiedById: userId,
        requestedAt: null,
        requestedById: null,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
        updatedAt: new Date(),
      })
      .where('id', '=', row.id)
      .execute();
  }

  async submitForApproval(workspaceId: string, userId: string, pageId: string) {
    const row = await this.db
      .selectFrom('pageVerifications')
      .select('id')
      .where('pageId', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Verification not found');

    await this.db
      .updateTable('pageVerifications')
      .set({
        status: 'in_approval',
        requestedAt: new Date(),
        requestedById: userId,
        updatedAt: new Date(),
      })
      .where('id', '=', row.id)
      .execute();
  }

  async rejectApproval(workspaceId: string, userId: string, dto: RejectApprovalDto) {
    const row = await this.db
      .selectFrom('pageVerifications')
      .select('id')
      .where('pageId', '=', dto.pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Verification not found');

    await this.db
      .updateTable('pageVerifications')
      .set({
        status: 'draft',
        rejectedAt: new Date(),
        rejectedById: userId,
        rejectionComment: dto.comment ?? null,
        updatedAt: new Date(),
      })
      .where('id', '=', row.id)
      .execute();
  }

  async markObsolete(workspaceId: string, pageId: string) {
    const row = await this.db
      .selectFrom('pageVerifications')
      .select('id')
      .where('pageId', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Verification not found');

    await this.db
      .updateTable('pageVerifications')
      .set({ status: 'obsolete', updatedAt: new Date() })
      .where('id', '=', row.id)
      .execute();
  }

  async list(workspaceId: string, dto: { spaceId?: string; status?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(dto.limit ?? PAGE_LIMIT, PAGE_LIMIT);
    let q = this.db
      .selectFrom('pageVerifications')
      .selectAll('pageVerifications')
      .leftJoin('pages', 'pages.id', 'pageVerifications.pageId')
      .leftJoin('spaces', 'spaces.id', 'pageVerifications.spaceId')
      .select([
        'pages.title as pageTitle',
        'pages.slugId as pageSlugId',
        'pages.icon as pageIcon',
        'spaces.name as spaceName',
        'spaces.slug as spaceSlug',
      ])
      .where('pageVerifications.workspaceId', '=', workspaceId)
      .orderBy('pageVerifications.updatedAt', 'desc')
      .limit(limit + 1);

    if (dto.spaceId) q = q.where('pageVerifications.spaceId', '=', dto.spaceId);
    if (dto.status) q = q.where('pageVerifications.status', '=', dto.status);
    if (dto.cursor) {
      q = q.where('pageVerifications.updatedAt', '<', dto.cursor as any);
    }

    const rows = await q.execute();
    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;

    const items = await Promise.all(
      page.map(async (r: any) => {
        const verifiers = await this.verifierRefs(r.id);
        const { pageTitle, pageSlugId, pageIcon, spaceName, spaceSlug, ...rest } = r;
        return {
          ...rest,
          pageTitle,
          pageSlugId,
          pageIcon,
          spaceName,
          spaceSlug,
          verifiers: verifiers.map((v) => ({ id: v.id, name: v.name, avatarUrl: v.avatarUrl })),
        };
      }),
    );

    return {
      items,
      meta: {
        limit,
        hasNextPage,
        hasPrevPage: !!dto.cursor,
        nextCursor: hasNextPage ? (items[items.length - 1] as any).updatedAt : null,
        prevCursor: dto.cursor ?? null,
      },
    };
  }
}

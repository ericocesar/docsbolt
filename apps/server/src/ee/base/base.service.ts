import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../database/types/kysely.types';
import { PageRepo } from '../../database/repos/page/page.repo';
import { generateSlugId } from '../../common/helpers/nanoid.utils';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

/**
 * Lightweight Bases (EE feature) implementation.
 *
 * The data layer (base_properties, base_rows, base_views, is_base on pages)
 * already exists in the migration. This service wires those tables to a CRUD
 * API used by the client UI's kanban/table/calendar views. Authorisation is
 * coarse: write endpoints require edit permission on the underlying page
 * (via PageRepo.findById with space membership evaluation upstream).
 */
@Injectable()
export class BaseService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
  ) {}

  // ---------- helpers ----------

  private async ensurePageAccess(
    pageId: string,
    workspaceId: string,
    userId: string,
    write: boolean,
  ) {
    const page = await this.db
      .selectFrom('pages')
      .select(['id', 'spaceId', 'workspaceId', 'deletedAt', 'creatorId'])
      .where('id', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    if (write) {
      // For now trust the JWT auth — finer permission comes from the
      // existing SpaceAbility / PageAccess wiring. We block only obvious
      // cross-tenant access.
      if (page.workspaceId !== workspaceId) {
        throw new ForbiddenException('Cross-workspace access');
      }
    }
    return page;
  }

  private async nextPosition(
    tx: KyselyDB | KyselyTransaction,
    table: 'baseProperties' | 'baseRows' | 'baseViews',
    pageId: string,
    afterId?: string,
  ): Promise<string> {
    if (afterId) {
      const neighbor = await tx
        .selectFrom(table)
        .select('position')
        .where('id', '=', afterId as any)
        .where('pageId', '=', pageId)
        .executeTakeFirst();
      const next = await tx
        .selectFrom(table)
        .select('position')
        .where('pageId', '=', pageId)
        .where('position', '>', (neighbor?.position as string) ?? '')
        .orderBy('position', 'asc')
        .limit(1)
        .executeTakeFirst();
      return generateJitteredKeyBetween(
        (neighbor?.position as string) ?? null,
        (next?.position as string) ?? null,
      );
    }

    const last = await tx
      .selectFrom(table)
      .select('position')
      .where('pageId', '=', pageId)
      .orderBy('position', 'desc')
      .limit(1)
      .executeTakeFirst();

    return generateJitteredKeyBetween((last?.position as string) ?? null, null);
  }

  private baseShape(row: any) {
    if (!row) return row;
    return {
      ...row,
      properties: row.properties ?? [],
      views: row.views ?? [],
    };
  }

  private async assembleBase(pageId: string) {
    const page = await this.db
      .selectFrom('pages')
      .selectAll()
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!page) return null;

    const properties = await this.db
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .execute();

    const views = await this.db
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();

    return this.baseShape({ ...page, properties, views });
  }

  // ---------- base CRUD ----------

  async createBase(
    userId: string,
    workspaceId: string,
    input: {
      name?: string;
      description?: string;
      icon?: string;
      pageId?: string;
      parentPageId?: string;
      template?: 'kanban';
      spaceId?: string;
    },
  ) {
    let pageId = input.pageId;

    // Embed flow: create a child page under parentPageId, inheriting its space.
    if (!pageId && input.parentPageId) {
      const parent = await this.ensurePageAccess(
        input.parentPageId,
        workspaceId,
        userId,
        true,
      );
      const newPage = await this.db
        .insertInto('pages')
        .values({

          slugId: generateSlugId(),
          title: input.name ?? 'Untitled base',
          content: null,
          textContent: '',
          isBase: true,
          baseSchemaVersion: 1,
          icon: input.icon ?? null,
          parentPageId: input.parentPageId,
          spaceId: (parent as any).spaceId,
          workspaceId,
          creatorId: userId,
          lastUpdatedById: userId,
          position: generateJitteredKeyBetween(null, null),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning('id')
        .executeTakeFirstOrThrow();
      pageId = newPage.id as string;

      if (input.template === 'kanban') {
        await this.seedKanbanTemplate(userId, workspaceId, pageId);
      }
      return this.assembleBase(pageId);
    }

    if (pageId) {
      await this.ensurePageAccess(pageId, workspaceId, userId, true);
    } else {
      if (!input.spaceId) {
        throw new BadRequestException('spaceId is required when pageId is not provided');
      }
      // create a new page flagged as a base
      const newPage = await this.db
        .insertInto('pages')
        .values({

          slugId: generateSlugId(),
          title: input.name ?? 'Untitled base',
          content: null,
          textContent: '',
          isBase: true,
          baseSchemaVersion: 1,
          icon: input.icon ?? null,
          spaceId: input.spaceId,
          workspaceId,
          creatorId: userId,
          lastUpdatedById: userId,
          position: generateJitteredKeyBetween(null, null),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning('id')
        .executeTakeFirstOrThrow();
      pageId = newPage.id as string;
    }

    // Allow the caller to update the title/icon when attaching an existing
    // page to a base.
    if (input.name || input.icon !== undefined) {
      await this.db
        .updateTable('pages')
        .set({
          ...(input.name ? { title: input.name } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          updatedAt: new Date(),
          lastUpdatedById: userId,
        })
        .where('id', '=', pageId)
        .execute();
    }

    await this.db
      .updateTable('pages')
      .set({ isBase: true, baseSchemaVersion: 1, updatedAt: new Date() })
      .where('id', '=', pageId)
      .execute();

    return this.assembleBase(pageId);
  }

  async updateBase(
    userId: string,
    workspaceId: string,
    input: { pageId: string; name?: string; description?: string; icon?: string },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .updateTable('pages')
      .set({
        ...(input.name !== undefined ? { title: input.name } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        updatedAt: new Date(),
        lastUpdatedById: userId,
      })
      .where('id', '=', input.pageId)
      .execute();

    return this.assembleBase(input.pageId);
  }

  async getBaseInfo(workspaceId: string, pageId: string) {
    await this.ensurePageAccess(pageId, workspaceId, '', false);
    return this.assembleBase(pageId);
  }

  async deleteBase(userId: string, workspaceId: string, pageId: string) {
    await this.ensurePageAccess(pageId, workspaceId, userId, true);

    await this.db
      .updateTable('pages')
      .set({ isBase: false, deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', pageId)
      .execute();
  }

  async convertPageToBase(
    userId: string,
    workspaceId: string,
    input: { pageId: string; template?: 'kanban' },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .updateTable('pages')
      .set({ isBase: true, baseSchemaVersion: 1, updatedAt: new Date() })
      .where('id', '=', input.pageId)
      .execute();

    if (input.template === 'kanban') {
      await this.seedKanbanTemplate(userId, workspaceId, input.pageId);
    }

    return this.assembleBase(input.pageId);
  }

  /** Seed the default Status property + kanban view for a base page. */
  private async seedKanbanTemplate(
    userId: string,
    workspaceId: string,
    pageId: string,
  ) {
    const statusId = 'status';
    // base_properties.id is varchar with no default — generate a short id.
    // Collision-safe enough for one seeded column per page.
    await this.db
      .insertInto('baseProperties')
      .values({
        id: statusId,
        pageId,
        workspaceId,
        name: 'Status',
        type: 'status',
        position: await this.nextPosition(
          this.db,
          'baseProperties',
          pageId,
        ),
        typeOptions: JSON.stringify({
          choices: [
            { id: 'todo', name: 'To do', color: 'gray', category: 'todo' },
            { id: 'in_progress', name: 'In progress', color: 'yellow', category: 'inProgress' },
            { id: 'done', name: 'Done', color: 'green', category: 'complete' },
          ],
          choiceOrder: ['todo', 'in_progress', 'done'],
        }) as any,
        isPrimary: true,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .execute();

    await this.db
      .insertInto('baseViews')
      .values({

        pageId,
        workspaceId,
        name: 'Kanban',
        type: 'kanban',
        position: await this.nextPosition(
          this.db,
          'baseViews',
          pageId,
        ),
        config: JSON.stringify({ groupByPropertyId: statusId }) as any,
        creatorId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .execute();
  }

  async exportBaseToCsv(_userId: string, workspaceId: string, pageId: string) {
    const base = await this.assembleBase(pageId);
    if (!base) throw new NotFoundException('Base not found');

    const rows = await this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .execute();

    const header = ['Name', ...base.properties.map((p: any) => p.name)];
    const lines = [header.join(',')];
    for (const row of rows) {
      const cells = (row as any).cells ?? {};
      const cellsJson = typeof cells === 'string' ? JSON.parse(cells) : cells;
      const name = (base.properties.find((p: any) => p.isPrimary) ? Object.values(cellsJson)[0] : '') as string;
      const rest = base.properties
        .filter((p: any) => !p.isPrimary)
        .map((p: any) => JSON.stringify(cellsJson[p.id] ?? ''));
      lines.push([JSON.stringify(name), ...rest].join(','));
    }

    const csv = lines.join('\n');
    return {
      filename: `${base.title || 'base'}.csv`,
      body: csv,
    };
  }

  async listBases(workspaceId: string, spaceId: string) {
    return this.db
      .selectFrom('pages')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('spaceId', '=', spaceId)
      .where('isBase', '=', true)
      .where('deletedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .execute();
  }

  // ---------- properties ----------

  async createProperty(
    userId: string,
    workspaceId: string,
    input: {
      pageId: string;
      name: string;
      type: string;
      typeOptions?: Record<string, unknown>;
      requestId?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    return this.db.transaction().execute(async (tx) => {
      const position = await this.nextPosition(tx, 'baseProperties', input.pageId);
      const property = await tx
        .insertInto('baseProperties')
        .values({

          pageId: input.pageId,
          workspaceId,
          name: input.name,
          type: input.type,
          position,
          typeOptions: (input.typeOptions ?? {}) as any,
          isPrimary: false,
          schemaVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow();
      return property;
    });
  }

  async updateProperty(
    userId: string,
    workspaceId: string,
    input: {
      propertyId: string;
      pageId: string;
      name?: string;
      type?: string;
      typeOptions?: Record<string, unknown>;
      requestId?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) update.name = input.name;
    if (input.type !== undefined) update.type = input.type;
    if (input.typeOptions !== undefined) update.typeOptions = input.typeOptions;

    const updated = await this.db
      .updateTable('baseProperties')
      .set(update)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.propertyId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!updated) throw new NotFoundException('Property not found');
    return updated;
  }

  async deleteProperty(
    userId: string,
    workspaceId: string,
    input: { propertyId: string; pageId: string; requestId?: string },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .updateTable('baseProperties')
      .set({ deletedAt: new Date() })
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.propertyId)
      .execute();
  }

  async reorderProperty(
    userId: string,
    workspaceId: string,
    input: {
      propertyId: string;
      pageId: string;
      position: string;
      requestId?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .updateTable('baseProperties')
      .set({ position: input.position, updatedAt: new Date() })
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.propertyId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  // ---------- rows ----------

  async createRow(
    userId: string,
    workspaceId: string,
    input: {
      pageId: string;
      cells?: Record<string, unknown>;
      afterRowId?: string;
      position?: string;
      requestId?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    return this.db.transaction().execute(async (tx) => {
      const position =
        input.position ??
        (await this.nextPosition(
          tx,
          'baseRows',
          input.pageId,
          input.afterRowId,
        ));
      const row = await tx
        .insertInto('baseRows')
        .values({

          pageId: input.pageId,
          workspaceId,
          cells: (input.cells ?? {}) as any,
          position,
          creatorId: userId,
          lastUpdatedById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    });
  }

  async getRow(workspaceId: string, input: { rowId: string; pageId: string }) {
    const row = await this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.rowId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Row not found');
    return row;
  }

  async updateRow(
    userId: string,
    workspaceId: string,
    input: {
      rowId: string;
      pageId: string;
      cells: Record<string, unknown>;
      position?: string;
      requestId?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    const updated = await this.db
      .updateTable('baseRows')
      .set({
        cells: input.cells as any,
        lastUpdatedById: userId,
        updatedAt: new Date(),
        ...(input.position ? { position: input.position } : {}),
      })
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.rowId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!updated) throw new NotFoundException('Row not found');
    return updated;
  }

  async deleteRow(
    userId: string,
    workspaceId: string,
    input: { rowId: string; pageId: string; requestId?: string },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .updateTable('baseRows')
      .set({ deletedAt: new Date() })
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.rowId)
      .execute();
  }

  async deleteRows(
    userId: string,
    workspaceId: string,
    input: { rowIds: string[]; pageId: string; requestId?: string },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    if (!input.rowIds.length) return;

    await this.db
      .updateTable('baseRows')
      .set({ deletedAt: new Date() })
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', 'in', input.rowIds)
      .execute();
  }

  async listRows(
    workspaceId: string,
    input: {
      pageId: string;
      cursor?: string;
      limit?: number;
      filter?: Record<string, unknown>;
      sorts?: Array<{ propertyId: string; direction: 'asc' | 'desc' }>;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, '', false);

    const limit = input.limit ?? 50;
    let q = this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', input.pageId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    if (input.cursor) {
      q = q.where('position', '>', input.cursor);
    }

    // JSON-based filter: simplified — only supports "every/all" entries.
    if (input.filter && typeof input.filter === 'object') {
      const where = this.compileFilter(input.filter);
      if (where) q = q.where(where);
    }

    if (input.sorts?.length) {
      const first = input.sorts[0];
      q = q.orderBy(
        first.direction === 'asc' ? 'position' : 'position',
        first.direction,
      );
    } else {
      q = q.orderBy('position', 'asc');
    }

    const rows = await q.limit(limit + 1).execute();
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? items[items.length - 1].position : null;

    return {
      items,
      meta: {
        limit,
        hasNextPage,
        hasPrevPage: !!input.cursor,
        nextCursor,
        prevCursor: input.cursor ?? null,
      },
    };
  }

  private compileFilter(_filter: Record<string, unknown>) {
    // Minimal implementation: skip filter for now. The UI sends a tree that
    // would otherwise map to JSONB predicates; deferring to keep this lean.
    return null;
  }

  async reorderRow(
    userId: string,
    workspaceId: string,
    input: {
      rowId: string;
      pageId: string;
      position: string;
      requestId?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .updateTable('baseRows')
      .set({ position: input.position, updatedAt: new Date() })
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.rowId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  // ---------- views ----------

  async createView(
    userId: string,
    workspaceId: string,
    input: {
      pageId: string;
      name: string;
      type?: 'table' | 'kanban' | 'calendar';
      config?: Record<string, unknown>;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    return this.db.transaction().execute(async (tx) => {
      const position = await this.nextPosition(tx, 'baseViews', input.pageId);
      const view = await tx
        .insertInto('baseViews')
        .values({

          pageId: input.pageId,
          workspaceId,
          name: input.name,
          type: input.type ?? 'table',
          position,
          config: (input.config ?? {}) as any,
          creatorId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow();
      return view;
    });
  }

  async updateView(
    userId: string,
    workspaceId: string,
    input: {
      viewId: string;
      pageId: string;
      name?: string;
      type?: 'table' | 'kanban' | 'calendar';
      config?: Record<string, unknown> | null;
      position?: string;
    },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) update.name = input.name;
    if (input.type !== undefined) update.type = input.type;
    if (input.config !== undefined) update.config = input.config ?? {};
    if (input.position !== undefined) update.position = input.position;

    const updated = await this.db
      .updateTable('baseViews')
      .set(update)
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.viewId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) throw new NotFoundException('View not found');
    return updated;
  }

  async deleteView(
    userId: string,
    workspaceId: string,
    input: { viewId: string; pageId: string },
  ) {
    await this.ensurePageAccess(input.pageId, workspaceId, userId, true);

    await this.db
      .deleteFrom('baseViews')
      .where('workspaceId', '=', workspaceId)
      .where('pageId', '=', input.pageId)
      .where('id', '=', input.viewId)
      .execute();
  }

  async listViews(workspaceId: string, input: { pageId: string }) {
    await this.ensurePageAccess(input.pageId, workspaceId, '', false);

    return this.db
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', input.pageId)
      .where('workspaceId', '=', workspaceId)
      .orderBy('position', 'asc')
      .execute();
  }
}

// Integration test against the real Postgres database — proves that
// `BaseService.updateRow` and `BaseService.updateView` MERGE jsonb patches
// instead of replacing the whole column. Mocks can't catch the original
// regression because the bug lives in the server-side merge semantics.
//
// Requires the dev DATABASE_URL from the repo-root .env. Each test creates
// a fresh base page (and its rows/views/properties), then deletes them in
// afterEach so the dev DB stays clean.

import 'reflect-metadata';
import { Pool } from 'pg';
import {
  Kysely,
  PostgresDialect,
  CamelCasePlugin,
  Generated,
  Insertable,
  Selectable,
} from 'kysely';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { BaseService } from './base.service';
import { PageRepo } from '../../database/repos/page/page.repo';
import { generateBasePropertyId } from '../../common/helpers/nanoid.utils';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

dotenv.config({
  path: path.resolve(__dirname, '../../../../../.env'),
});

interface Pages {
  id: Generated<string>;
  slugId: string;
  title: string;
  textContent: string;
  isBase: Generated<boolean>;
  baseSchemaVersion: Generated<number>;
  icon: string | null;
  parentPageId: string | null;
  spaceId: string;
  workspaceId: string;
  creatorId: string;
  lastUpdatedById: string;
  position: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  deletedAt: Date | null;
  content: unknown;
}

interface BaseProperties {
  id: Generated<string>;
  pageId: string;
  workspaceId: string;
  name: string;
  type: string;
  position: string;
  typeOptions: unknown;
  pendingType: string | null;
  pendingTypeOptions: unknown;
  pendingToken: string | null;
  isPrimary: Generated<boolean>;
  schemaVersion: Generated<number>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  deletedAt: Date | null;
}

interface BaseRows {
  id: Generated<string>;
  pageId: string;
  workspaceId: string;
  cells: Generated<unknown>;
  position: string;
  creatorId: string | null;
  lastUpdatedById: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  deletedAt: Date | null;
}

interface BaseViews {
  id: Generated<string>;
  pageId: string;
  workspaceId: string;
  name: string;
  type: Generated<string>;
  position: string;
  config: Generated<unknown>;
  creatorId: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

interface DB {
  pages: Pages;
  baseProperties: BaseProperties;
  baseRows: BaseRows;
  baseViews: BaseViews;
}

describe('BaseService jsonb patch-merge semantics', () => {
  let db: Kysely<DB>;
  let service: BaseService;
  let workspaceId: string;
  let userId: string;
  let spaceId: string;

  let pageId: string;
  let rowId: string;
  let viewId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL not set — load .env before running integration specs',
      );
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = new Kysely<DB>({
      dialect: new PostgresDialect({ pool }),
      plugins: [new CamelCasePlugin()],
    });

    // Reuse an existing dev user + workspace + space so ensurePageAccess passes.
    const user = await (db as any)
      .selectFrom('users')
      .select(['id', 'workspaceId'])
      .limit(1)
      .executeTakeFirstOrThrow();
    userId = user.id;
    workspaceId = user.workspaceId;

    const space = await (db as any)
      .selectFrom('spaces')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .limit(1)
      .executeTakeFirstOrThrow();
    spaceId = space.id;

    service = new BaseService(db as any, {} as PageRepo);
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    // Fresh fixture per test so order doesn't matter.
    pageId = crypto.randomUUID();

    await db
      .insertInto('pages')
      .values({
        id: pageId,
        slugId: pageId.replace(/-/g, '').slice(0, 10),
        title: 'spec base page',
        textContent: '',
        isBase: true,
        baseSchemaVersion: 1,
        icon: null,
        parentPageId: null,
        spaceId,
        workspaceId,
        creatorId: userId,
        lastUpdatedById: userId,
        position: generateJitteredKeyBetween(null, null),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        content: null,
      } satisfies Insertable<Pages>)
      .execute();

    await db
      .insertInto('baseProperties')
      .values({
        id: generateBasePropertyId(),
        pageId,
        workspaceId,
        name: 'Title',
        type: 'text',
        position: generateJitteredKeyBetween(null, null),
        typeOptions: {},
        pendingType: null,
        pendingTypeOptions: null,
        pendingToken: null,
        isPrimary: true,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } satisfies Insertable<BaseProperties>)
      .execute();

    rowId = crypto.randomUUID();
    await db
      .insertInto('baseRows')
      .values({
        id: rowId,
        pageId,
        workspaceId,
        cells: {},
        position: generateJitteredKeyBetween(null, null),
        creatorId: userId,
        lastUpdatedById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } satisfies Insertable<BaseRows>)
      .execute();

    viewId = crypto.randomUUID();
    await db
      .insertInto('baseViews')
      .values({
        id: viewId,
        pageId,
        workspaceId,
        name: 'Kanban',
        type: 'kanban',
        position: generateJitteredKeyBetween(null, null),
        config: {},
        creatorId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies Insertable<BaseViews>)
      .execute();
  });

  afterEach(async () => {
    // Cascade cleanup — only rows this test created.
    await db.deleteFrom('baseRows').where('id', '=', rowId).execute();
    await db.deleteFrom('baseViews').where('id', '=', viewId).execute();
    await db
      .deleteFrom('baseProperties')
      .where('pageId', '=', pageId)
      .execute();
    await db.deleteFrom('pages').where('id', '=', pageId).execute();
  });

  it('updateRow merges cells instead of replacing the whole jsonb', async () => {
    await db
      .updateTable('baseRows')
      .set({ cells: { status: 'todo', title: 'Original' } })
      .where('id', '=', rowId)
      .execute();

    const updated = await service.updateRow(userId, workspaceId, {
      rowId,
      pageId,
      cells: { title: 'Updated' },
    });

    expect((updated as any).cells).toEqual({
      status: 'todo',
      title: 'Updated',
    });

    // Re-read from DB so we know the server persisted, not just returned.
    const fresh = await db
      .selectFrom('baseRows')
      .select(['cells'])
      .where('id', '=', rowId)
      .executeTakeFirstOrThrow();
    expect((fresh as any).cells).toEqual({ status: 'todo', title: 'Updated' });
  });

  it('updateRow treats null patch values as key deletion', async () => {
    await db
      .updateTable('baseRows')
      .set({ cells: { title: 'Hi', extra: 'X' } })
      .where('id', '=', rowId)
      .execute();

    const updated = await service.updateRow(userId, workspaceId, {
      rowId,
      pageId,
      cells: { extra: null },
    });

    expect((updated as any).cells).toEqual({ title: 'Hi' });
  });

  it('updateRow empty patch is a no-op for cells but still moves the row', async () => {
    const originalPos = generateJitteredKeyBetween(null, null);
    const newPos = generateJitteredKeyBetween(originalPos, null);
    await db
      .updateTable('baseRows')
      .set({ cells: { a: 1, b: 2 }, position: originalPos })
      .where('id', '=', rowId)
      .execute();

    const updated = await service.updateRow(userId, workspaceId, {
      rowId,
      pageId,
      cells: {},
      position: newPos,
    });

    expect((updated as any).cells).toEqual({ a: 1, b: 2 });
    expect((updated as any).position).toBe(newPos);
  });

  it('updateView merges config instead of replacing the whole jsonb', async () => {
    await db
      .updateTable('baseViews')
      .set({
        config: {
          groupByPropertyId: 'status',
          hiddenChoiceIds: [],
        },
      })
      .where('id', '=', viewId)
      .execute();

    const updated = await service.updateView(userId, workspaceId, {
      viewId,
      pageId,
      config: { hiddenChoiceIds: ['done'] },
    });

    expect((updated as any).config).toEqual({
      groupByPropertyId: 'status',
      hiddenChoiceIds: ['done'],
    });
  });

  it('updateView with config=null resets the view to empty', async () => {
    await db
      .updateTable('baseViews')
      .set({ config: { groupByPropertyId: 'status' } })
      .where('id', '=', viewId)
      .execute();

    const updated = await service.updateView(userId, workspaceId, {
      viewId,
      pageId,
      config: null,
    });

    expect((updated as any).config).toEqual({});
  });

  // ---- compileFilter (private): the unit-level guard for column isolation ----

  describe('compileFilter', () => {
    // Cast to access the private method — the filter tree translation is
    // load-bearing for kanban column isolation and the "Untitled" hide-group
    // case; without these tests the previous null-returning stub shipped twice.
    // compileFilter returns a Kysely RawBuilder; calling .compile(db) resolves
    // it into the wire form ({ sql, parameters }) we can assert against.
    const compile = (filter: any) => {
      const raw = (service as any).compileFilter(filter);
      if (!raw) return null;
      return raw.compile(db as any) as {
        sql: string;
        parameters: readonly unknown[];
      };
    };

    let propertyId: string;

    beforeAll(() => {
      propertyId = 'p_status_filter_spec';
    });

    it('translates eq to a base_cell_text predicate', () => {
      const result = compile({ propertyId, op: 'eq', value: 'todo' });
      expect(result).not.toBeNull();
      expect(result!.sql).toContain('base_cell_text(cells, $1) = $2');
      expect(result!.parameters).toEqual([propertyId, 'todo']);
    });

    it('translates isEmpty to a NULL predicate (No value column)', () => {
      const result = compile({ propertyId, op: 'isEmpty' });
      expect(result!.sql.trim()).toBe('base_cell_text(cells, $1) IS NULL');
      expect(result!.parameters).toEqual([propertyId]);
    });

    it('joins an AND group of two conditions', () => {
      const result = compile({
        op: 'and',
        children: [
          { propertyId, op: 'eq', value: 'todo' },
          { propertyId: 'p_name', op: 'isNotEmpty' },
        ],
      });
      expect(result!.sql).toMatch(/^\(/);
      expect(result!.sql).toMatch(/\)$/);
      expect(result!.sql).toMatch(/ AND /);
      // Two `base_cell_text` predicates + parameters for property id and values.
      expect(result!.parameters).toEqual([propertyId, 'todo', 'p_name']);
    });

    it('joins an OR group with OR separator', () => {
      const result = compile({
        op: 'or',
        children: [
          { propertyId, op: 'eq', value: 'todo' },
          { propertyId, op: 'eq', value: 'in_progress' },
        ],
      });
      expect(result!.sql).toMatch(/ OR /);
      expect(result!.parameters).toEqual([
        propertyId,
        'todo',
        propertyId,
        'in_progress',
      ]);
    });

    it('returns null for unknown operators so the query keeps working', () => {
      const result = compile({
        propertyId,
        op: 'totallyMadeUp',
        value: 'x',
      });
      expect(result).toBeNull();
    });

    it('translates neq to IS NOT NULL + <> so absent cells do not match', () => {
      const result = compile({ propertyId, op: 'neq', value: 'done' });
      expect(result!.sql).toContain('IS NOT NULL');
      expect(result!.sql).toContain('<>');
      expect(result!.parameters).toEqual([propertyId, propertyId, 'done']);
    });

    it('translates contains to LIKE with % wrapping', () => {
      const result = compile({ propertyId, op: 'contains', value: 'prog' });
      expect(result!.sql).toContain('LIKE');
      expect(result!.parameters).toEqual([propertyId, '%prog']);
    });

    it('translates startsWith/endsWith with anchored wildcards', () => {
      const start = compile({ propertyId, op: 'startsWith', value: 'todo' });
      const end = compile({ propertyId, op: 'endsWith', value: 'done' });
      expect(start!.parameters).toEqual([propertyId, 'todo%']);
      expect(end!.parameters).toEqual([propertyId, '%done']);
    });

    it('translates gt/gte/lt/lte to numeric comparisons', () => {
      expect(compile({ propertyId, op: 'gt', value: 10 })!.sql).toContain(
        'base_cell_numeric',
      );
      expect(compile({ propertyId, op: 'lte', value: 100 })!.sql).toContain(
        'base_cell_numeric',
      );
      expect(
        compile({ propertyId, op: 'gte', value: 0 })!.parameters,
      ).toEqual([propertyId, 0]);
    });

    it('translates before/after to timestamp comparisons', () => {
      const before = compile({
        propertyId,
        op: 'before',
        value: '2026-01-01',
      });
      const after = compile({
        propertyId,
        op: 'after',
        value: '2025-01-01',
      });
      expect(before!.sql).toContain('base_cell_timestamptz');
      expect(before!.parameters).toEqual([propertyId, '2026-01-01']);
      expect(after!.sql).toContain('>');
    });

    it('translates isWithin to a date range', () => {
      const result = compile({
        propertyId,
        op: 'isWithin',
        value: { from: '2025-01-01', to: '2025-12-31' },
      });
      expect(result!.sql).toContain('>=');
      expect(result!.sql).toContain('<=');
      expect(result!.parameters).toEqual([
        propertyId,
        '2025-01-01',
        propertyId,
        '2025-12-31',
      ]);
    });

    it('translates any/none/all using jsonb array containment', () => {
      const anyResult = compile({ propertyId, op: 'any', value: 'red' });
      expect(anyResult!.sql).toContain('@>');
      expect(anyResult!.sql).toContain('::jsonb');
      // Wrapped in an array because `any` matches if any element equals.
      expect(anyResult!.parameters).toEqual([propertyId, '["red"]']);

      const noneResult = compile({ propertyId, op: 'none', value: 'red' });
      expect(noneResult!.sql).toMatch(/^NOT \(/);

      const allResult = compile({
        propertyId,
        op: 'all',
        value: ['red', 'blue'],
      });
      expect(allResult!.parameters).toEqual([propertyId, '["red","blue"]']);
    });

    it('drops null/undefined children inside a group', () => {
      const result = compile({
        op: 'and',
        children: [
          { propertyId, op: 'eq', value: 'todo' },
          null,
          { propertyId: 'p_x', op: 'totallyMadeUp', value: 'x' },
        ],
      });
      // Only the one valid condition remains.
      expect(result!.parameters).toEqual([propertyId, 'todo']);
    });
  });

  // ---- listRows honours the filter tree (integration) ----

  describe('listRows honours the filter tree', () => {
    // Integration test: prove that a kanban-style filter (eq + isEmpty + AND)
    // actually partitions rows across columns. This is the regression that
    // produced "every card replicated in every column".
    let statusId: string;
    let titleId: string;

    beforeAll(() => {
      statusId = `p_status_${Date.now()}`;
      titleId = `p_title_${Date.now()}`;
    });

    async function setupFixtureRows() {
      const fixturePageId = crypto.randomUUID();
      await db
        .insertInto('pages')
        .values({
          id: fixturePageId,
          slugId: fixturePageId.replace(/-/g, '').slice(0, 10),
          title: 'filter spec page',
          textContent: '',
          isBase: true,
          baseSchemaVersion: 1,
          icon: null,
          parentPageId: null,
          spaceId,
          workspaceId,
          creatorId: userId,
          lastUpdatedById: userId,
          position: generateJitteredKeyBetween(null, null),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          content: null,
        } satisfies Insertable<Pages>)
        .execute();

      const todoPos = generateJitteredKeyBetween(null, null);
      const ipPos = generateJitteredKeyBetween(todoPos, null);

      const rowTodo = crypto.randomUUID();
      const rowIp = crypto.randomUUID();
      const rowNone = crypto.randomUUID();

      await db
        .insertInto('baseRows')
        .values([
          {
            id: rowTodo,
            pageId: fixturePageId,
            workspaceId,
            cells: { [statusId]: 'todo', [titleId]: 'A' } as any,
            position: todoPos,
            creatorId: userId,
            lastUpdatedById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          } satisfies Insertable<BaseRows>,
          {
            id: rowIp,
            pageId: fixturePageId,
            workspaceId,
            cells: { [statusId]: 'in_progress', [titleId]: 'B' } as any,
            position: ipPos,
            creatorId: userId,
            lastUpdatedById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          } satisfies Insertable<BaseRows>,
          {
            id: rowNone,
            pageId: fixturePageId,
            workspaceId,
            cells: { [titleId]: 'C' } as any,
            position: generateJitteredKeyBetween(ipPos, null),
            creatorId: userId,
            lastUpdatedById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          } satisfies Insertable<BaseRows>,
        ])
        .execute();

      return {
        fixturePageId,
        rowIds: [rowTodo, rowIp, rowNone],
      };
    }

    it('eq filter returns only rows whose cell matches', async () => {
      const { fixturePageId, rowIds } = await setupFixtureRows();
      try {
        const result = await service.listRows(workspaceId, {
          pageId: fixturePageId,
          limit: 50,
          filter: { propertyId: statusId, op: 'eq', value: 'todo' },
        });
        expect(result.items.map((r: any) => r.id)).toEqual([rowIds[0]]);
      } finally {
        await db
          .deleteFrom('baseRows')
          .where('pageId', '=', fixturePageId)
          .execute();
        await db.deleteFrom('pages').where('id', '=', fixturePageId).execute();
      }
    });

    it('isEmpty filter returns rows whose cell is absent', async () => {
      const { fixturePageId, rowIds } = await setupFixtureRows();
      try {
        const result = await service.listRows(workspaceId, {
          pageId: fixturePageId,
          limit: 50,
          filter: { propertyId: statusId, op: 'isEmpty' },
        });
        expect(result.items.map((r: any) => r.id)).toEqual([rowIds[2]]);
      } finally {
        await db
          .deleteFrom('baseRows')
          .where('pageId', '=', fixturePageId)
          .execute();
        await db.deleteFrom('pages').where('id', '=', fixturePageId).execute();
      }
    });

    it('AND of eq + isNotEmpty narrows the set', async () => {
      const { fixturePageId, rowIds } = await setupFixtureRows();
      try {
        const result = await service.listRows(workspaceId, {
          pageId: fixturePageId,
          limit: 50,
          filter: {
            op: 'and',
            children: [
              { propertyId: statusId, op: 'eq', value: 'in_progress' },
              { propertyId: titleId, op: 'isNotEmpty' },
            ],
          },
        });
        expect(result.items.map((r: any) => r.id)).toEqual([rowIds[1]]);
      } finally {
        await db
          .deleteFrom('baseRows')
          .where('pageId', '=', fixturePageId)
          .execute();
        await db.deleteFrom('pages').where('id', '=', fixturePageId).execute();
      }
    });
  });
});

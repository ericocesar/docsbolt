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
});

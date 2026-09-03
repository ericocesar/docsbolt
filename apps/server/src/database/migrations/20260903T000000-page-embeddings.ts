import { type Kysely, sql } from 'kysely';

// AI Search requires pgvector extension and a page_embeddings table.
// Migration is idempotent so it can be applied safely on existing databases.
//
// Schema matches PageEmbeddings in @docmost/db/types/embeddings.types.ts
// except `embedding` is stored as pgvector (`vector(N)`) instead of number[]
// — TypeScript type still uses number[], conversion is handled via sql template.
//
// Dimension note: AI_EMBEDDING_DIMENSION validator only accepts
//   ['768', '1024', '1536', '2000', '3072'].
// qwen/qwen3-embedding-8b default output is 4096; with MRL (Matryoshka) it
// can be truncated to 1024 — pick that to stay within the allowlist.
// If you change dimension, edit the vector(...) literal below AND set
// AI_EMBEDDING_DIMENSION in .env to the same value.
const EMBEDDING_DIM = 1024;

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('page_embeddings')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('embedding', sql`vector(${sql.lit(EMBEDDING_DIM)})`, (col) =>
      col.notNull(),
    )
    .addColumn('content_hash', 'varchar', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_page_embeddings_workspace')
    .ifNotExists()
    .on('page_embeddings')
    .column('workspace_id')
    .execute();

  // unique — required by the upsert (ON CONFLICT (page_id)) in EmbeddingsRepo
  await db.schema
    .createIndex('idx_page_embeddings_page')
    .ifNotExists()
    .unique()
    .on('page_embeddings')
    .column('page_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_embeddings').ifExists().execute();
  // leave vector extension installed on down — other schemas may depend on it
}

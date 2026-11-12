import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_subject_unique
    ON auth_accounts (workspace_id, auth_provider_id, provider_user_id)
    WHERE deleted_at IS NULL`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS auth_accounts_provider_subject_unique`.execute(
    db,
  );
}

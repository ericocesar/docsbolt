import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageEmbedding } from '@docmost/db/types/entity.types';
import { sql } from 'kysely';

@Injectable()
export class EmbeddingsRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  /**
   * Upsert the embedding row for a page. Uses raw SQL for the `embedding`
   * column so pgvector receives the array literal in the format it expects
   * (`[1,2,3]::vector`) — Kysely's JSON marshalling would otherwise stringify
   * the number[] and break the cast.
   */
  async upsertForPage(input: {
    pageId: string;
    spaceId: string;
    workspaceId: string;
    embedding: number[];
    contentHash: string;
  }): Promise<PageEmbedding> {
    const vectorLiteral = `[${input.embedding.join(',')}]`;

    const rows = await sql<PageEmbedding>`
      INSERT INTO page_embeddings
        (page_id, space_id, workspace_id, embedding, content_hash, created_at, updated_at)
      VALUES
        (
          ${input.pageId},
          ${input.spaceId},
          ${input.workspaceId},
          ${vectorLiteral}::vector,
          ${input.contentHash},
          now(),
          now()
        )
      ON CONFLICT (page_id) DO UPDATE
        SET embedding = excluded.embedding,
            content_hash = excluded.content_hash,
            updated_at = now()
      RETURNING *
    `.execute(this.db);

    return rows.rows[0];
  }

  async deleteForPage(pageId: string) {
    await this.db.deleteFrom('pageEmbeddings').where('pageId', '=', pageId).execute();
  }

  async deleteForWorkspace(workspaceId: string) {
    await this.db
      .deleteFrom('pageEmbeddings')
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async findByWorkspace(workspaceId: string, limit = 1000): Promise<PageEmbedding[]> {
    return this.db
      .selectFrom('pageEmbeddings')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .execute();
  }

  /**
   * Cosine similarity search. Returns up to `limit` rows with similarity in
   * [-1, 1] (1 = identical direction). The query embedding is passed as a
   * pgvector literal so the `<=>` operator (cosine distance) returns the
   * ranking directly.
   */
  async searchSimilar(opts: {
    workspaceId: string;
    queryEmbedding: number[];
    limit: number;
    minSimilarity?: number;
  }): Promise<Array<{ pageId: string; similarity: number }>> {
    const queryVec = `[${opts.queryEmbedding.join(',')}]`;
    const minSim = opts.minSimilarity ?? 0.0;

    const rows = await sql<{ pageId: string; similarity: number }>`
      SELECT page_id AS "pageId",
             1 - (embedding <=> ${queryVec}::vector) AS similarity
      FROM page_embeddings
      WHERE workspace_id = ${opts.workspaceId}
        AND 1 - (embedding <=> ${queryVec}::vector) >= ${minSim}
      ORDER BY embedding <=> ${queryVec}::vector ASC
      LIMIT ${opts.limit}
    `.execute(this.db);

    return rows.rows;
  }
}

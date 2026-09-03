import { Timestamp, Generated } from '@docmost/db/types/db';

// `embedding` is stored as pgvector `vector(N)` in the database but exposed as
// number[] at the TypeScript level. Conversion is handled at the repository
// layer via raw SQL (`sql\`${val}::vector\``) so Kysely's JSON marshalling
// does not interfere with pgvector's array literal syntax.
export interface PageEmbeddings {
  id: Generated<string>;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  embedding: number[];
  contentHash: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

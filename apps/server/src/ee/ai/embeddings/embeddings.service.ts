import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { EmbeddingsRepo } from './embeddings.repo';
import { OpenAICompatibleProviderFactory } from '../providers/openai-compatible.provider';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

/**
 * Embeddings service — generates vector embeddings for page content and
 * exposes cosine-similarity search. Also provides `retrieveContext` used by
 * the AI chat service to inject RAG context into the prompt.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  /** Provider-side max input length, kept conservative. */
  private static readonly MAX_INPUT_CHARS = 8000;

  constructor(
    private readonly repo: EmbeddingsRepo,
    private readonly providerFactory: OpenAICompatibleProviderFactory,
    private readonly environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  /**
   * Generate (or refresh) the embedding for a single page. Skips the call if
   * the page content hash matches what is already stored.
   */
  async embedPage(pageId: string): Promise<void> {
    const page = await this.db
      .selectFrom('pages')
      .select(['id', 'spaceId', 'workspaceId', 'title', 'textContent'])
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!page) {
      this.logger.warn(`embedPage: page ${pageId} not found`);
      return;
    }
    if (!page.workspaceId) {
      this.logger.warn(`embedPage: page ${pageId} has no workspaceId`);
      return;
    }

    const text = this.composePageText(page.title, page.textContent ?? '');
    const hash = hashContent(text);

    // Cheap skip: hash unchanged → no work
    const existing = await this.db
      .selectFrom('pageEmbeddings')
      .select(['contentHash'])
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    if (existing?.contentHash === hash) {
      this.logger.debug(`embedPage: ${pageId} hash unchanged, skipping`);
      return;
    }

    const embedding = await this.generateEmbedding(text);

    await this.repo.upsertForPage({
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      embedding,
      contentHash: hash,
    });
  }

  async deleteEmbeddingForPage(pageId: string) {
    await this.repo.deleteForPage(pageId);
  }

  async deleteAllForWorkspace(workspaceId: string) {
    await this.repo.deleteForWorkspace(workspaceId);
  }

  async bulkEmbedWorkspace(workspaceId: string, batchSize = 32) {
    const pages = await this.db
      .selectFrom('pages')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();

    this.logger.log(`bulkEmbedWorkspace: ${pages.length} pages in workspace ${workspaceId}`);

    for (const p of pages) {
      try {
        await this.embedPage(p.id);
      } catch (err: any) {
        this.logger.warn(
          `bulkEmbed: failed for page ${p.id}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Vector-similarity RAG retrieval. Returns up to `limit` page snippets
   * (truncated to ~500 chars each) ready to drop into a system prompt.
   */
  async retrieveContext(opts: {
    workspaceId: string;
    query: string;
    limit: number;
  }): Promise<Array<{ pageId: string; title: string; snippet: string; similarity: number }>> {
    try {
      const embedding = await this.generateEmbedding(opts.query);
      const hits = await this.repo.searchSimilar({
        workspaceId: opts.workspaceId,
        queryEmbedding: embedding,
        limit: opts.limit,
        minSimilarity: 0.5,
      });

      if (!hits.length) return [];

      const pageRows = await this.db
        .selectFrom('pages')
        .select(['id', 'title', 'textContent'])
        .where(
          'id',
          'in',
          hits.map((h) => h.pageId),
        )
        .execute();

      const byId = new Map(pageRows.map((p) => [p.id, p]));

      return hits
        .map((h) => {
          const page = byId.get(h.pageId);
          if (!page) return null;
          return {
            pageId: h.pageId,
            title: page.title ?? '(untitled)',
            snippet: (page.textContent ?? '').slice(0, 500),
            similarity: h.similarity,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } catch (err: any) {
      this.logger.warn(`retrieveContext failed: ${err.message}`);
      return [];
    }
  }

  // ---- helpers ----

  private async generateEmbedding(text: string): Promise<number[]> {
    const provider = this.providerFactory.create();
    const model = this.environmentService.getAiEmbeddingModel();
    const dim = this.environmentService.getAiEmbeddingDimension();
    const supportsMrl = this.environmentService.getAiEmbeddingSupportsMrl();

    const input = text.slice(0, EmbeddingsService.MAX_INPUT_CHARS);
    const response = await provider.embed({
      model,
      input: [input],
      ...(supportsMrl && dim ? { dimensions: dim } : {}),
    });

    const embedding = response.embeddings[0];
    if (!embedding?.length) {
      throw new Error('Embedding provider returned empty vector');
    }
    return embedding;
  }

  private composePageText(title: string | null, content: string): string {
    const t = (title ?? '').trim();
    if (!t) return content.trim();
    return `${t}\n\n${content}`.trim();
  }
}

function hashContent(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

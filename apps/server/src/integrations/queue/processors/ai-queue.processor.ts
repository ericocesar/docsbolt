import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../constants';
import { EmbeddingsService } from '../../../ee/ai/embeddings/embeddings.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface PageIdsJob {
  pageIds: string[];
  workspaceId?: string;
}

interface WorkspaceJob {
  workspaceId: string;
}

/**
 * AI queue worker — handles embeddings lifecycle:
 *   PAGE_CREATED              → embed each new page
 *   PAGE_UPDATED              → re-embed (content hash check skips unchanged)
 *   PAGE_DELETED              → remove embeddings for those pages
 *   PAGE_SOFT_DELETED         → remove embeddings (soft-deleted pages are invisible to search)
 *   PAGE_RESTORED             → re-embed
 *   GENERATE_PAGE_EMBEDDINGS  → re-embed a single page (manual trigger)
 *   DELETE_PAGE_EMBEDDINGS    → drop embeddings for one page
 *   WORKSPACE_CREATE_EMBEDDINGS → bulk embed an entire workspace (on aiSearch toggle on)
 *   WORKSPACE_DELETE_EMBEDDINGS → purge embeddings (on toggle off / workspace deleted)
 *   WORKSPACE_RESET_EMBEDDINGS  → drop then bulk re-embed
 */
@Processor(QueueName.AI_QUEUE)
export class AiQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(AiQueueProcessor.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    @InjectQueue(QueueName.AI_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QueueJob.PAGE_CREATED:
      case QueueJob.PAGE_UPDATED:
      case QueueJob.PAGE_RESTORED:
      case QueueJob.GENERATE_PAGE_EMBEDDINGS: {
        const { pageIds } = job.data as PageIdsJob;
        for (const pageId of pageIds ?? []) {
          try {
            await this.embeddings.embedPage(pageId);
          } catch (err: any) {
            this.logger.warn(
              `${job.name} embed failed for page ${pageId}: ${err.message}`,
            );
          }
        }
        return;
      }

      case QueueJob.PAGE_DELETED:
      case QueueJob.PAGE_SOFT_DELETED:
      case QueueJob.DELETE_PAGE_EMBEDDINGS: {
        const { pageIds } = job.data as PageIdsJob;
        for (const pageId of pageIds ?? []) {
          await this.embeddings.deleteEmbeddingForPage(pageId);
        }
        return;
      }

      case QueueJob.WORKSPACE_CREATE_EMBEDDINGS:
      case QueueJob.WORKSPACE_RESET_EMBEDDINGS: {
        const { workspaceId } = job.data as WorkspaceJob;
        if (job.name === QueueJob.WORKSPACE_RESET_EMBEDDINGS) {
          await this.embeddings.deleteAllForWorkspace(workspaceId);
        }
        await this.embeddings.bulkEmbedWorkspace(workspaceId);
        return;
      }

      case QueueJob.WORKSPACE_DELETE_EMBEDDINGS: {
        const { workspaceId } = job.data as WorkspaceJob;
        await this.embeddings.deleteAllForWorkspace(workspaceId);
        return;
      }

      default:
        // Other AI_QUEUE jobs (e.g. workspace-deleted) are no-ops for embeddings.
        return;
    }
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `AI_QUEUE ${job.name} failed: ${job.failedReason}`,
    );
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}

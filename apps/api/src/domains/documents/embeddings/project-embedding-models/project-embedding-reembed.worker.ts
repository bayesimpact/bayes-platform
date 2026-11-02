import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { PROJECT_EMBEDDING_REEMBED_QUEUE_NAME } from "./project-embedding-reembed.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingReembedService } from "./project-embedding-reembed.service"
import type { ReembedProjectChunksJobPayload } from "./project-embedding-reembed.types"

@Processor(PROJECT_EMBEDDING_REEMBED_QUEUE_NAME, {
  // One project at a time per worker: the job is long and the embedding model is shared.
  concurrency: 1,
  maxStalledCount: 3,
})
export class ProjectEmbeddingReembedWorker extends WorkerHost {
  private readonly logger = new Logger(ProjectEmbeddingReembedWorker.name)

  constructor(private readonly reembedService: ProjectEmbeddingReembedService) {
    super()
  }

  async process(job: Job<ReembedProjectChunksJobPayload>): Promise<void> {
    await this.reembedService.reembedProjectChunks(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<ReembedProjectChunksJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<ReembedProjectChunksJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id})`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<ReembedProjectChunksJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}

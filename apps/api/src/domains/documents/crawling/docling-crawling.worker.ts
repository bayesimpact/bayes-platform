import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import {
  DOCLING_CRAWLING_JOB_NAME,
  DOCLING_CRAWLING_QUEUE_NAME,
} from "./docling-crawling.constants"
import type { CrawlUrlDoclingJobPayload } from "./docling-crawling.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DoclingCrawlingProcessorService } from "./docling-crawling-processor.service"

@Processor(DOCLING_CRAWLING_QUEUE_NAME, {
  concurrency: 1,
  maxStalledCount: 3,
  lockDuration: 300_000,
})
export class DoclingCrawlingWorker extends WorkerHost {
  private readonly logger = new Logger(DoclingCrawlingWorker.name)

  constructor(private readonly crawlingProcessorService: DoclingCrawlingProcessorService) {
    super()
  }

  async process(job: Job<CrawlUrlDoclingJobPayload>): Promise<void> {
    if (job.name !== DOCLING_CRAWLING_JOB_NAME) {
      return
    }

    await this.crawlingProcessorService.processCrawlJob(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<CrawlUrlDoclingJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id}) → ${job.data.url}`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<CrawlUrlDoclingJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id}) → ${job.data.url}`)
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<CrawlUrlDoclingJobPayload> | undefined, error: Error): Promise<void> {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"}) → ${job?.data.url ?? "unknown url"}`,
      error.stack,
    )
    if (job) {
      await this.crawlingProcessorService.markCrawlJobFailed(job.data, error)
    }
  }
}

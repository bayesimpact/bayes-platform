import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { URL_CRAWLING_JOB_NAME, URL_CRAWLING_QUEUE_NAME } from "./url-crawling.constants"
import type { CrawlUrlJobPayload } from "./url-crawling.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UrlCrawlingProcessorService } from "./url-crawling-processor.service"

@Processor(URL_CRAWLING_QUEUE_NAME)
export class UrlCrawlingWorker extends WorkerHost {
  private readonly logger = new Logger(UrlCrawlingWorker.name)

  constructor(private readonly crawlingProcessorService: UrlCrawlingProcessorService) {
    super()
  }

  async process(job: Job<CrawlUrlJobPayload>): Promise<void> {
    if (job.name !== URL_CRAWLING_JOB_NAME) {
      return
    }

    await this.crawlingProcessorService.processCrawlJob(job.data)
  }

  @OnWorkerEvent("active")
  onActive(job: Job<CrawlUrlJobPayload>): void {
    this.logger.log(`Job active: ${job.name} (${job.id}) → ${job.data.url}`)
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<CrawlUrlJobPayload>): void {
    this.logger.log(`Job completed: ${job.name} (${job.id}) → ${job.data.url}`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<CrawlUrlJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"}) → ${job?.data.url ?? "unknown url"}`,
      error.stack,
    )
  }
}

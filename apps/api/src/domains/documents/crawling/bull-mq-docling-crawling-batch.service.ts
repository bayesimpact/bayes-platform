import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import {
  DOCLING_CRAWLING_JOB_NAME,
  DOCLING_CRAWLING_QUEUE_NAME,
} from "./docling-crawling.constants"
import type { CrawlUrlDoclingJobPayload } from "./docling-crawling.types"

@Injectable()
export class BullMqDoclingCrawlingBatchService {
  private readonly logger = new Logger(BullMqDoclingCrawlingBatchService.name)

  constructor(
    @InjectQueue(DOCLING_CRAWLING_QUEUE_NAME)
    private readonly doclingCrawlingQueue: Queue<CrawlUrlDoclingJobPayload>,
  ) {}

  async enqueueCrawlUrl(payload: CrawlUrlDoclingJobPayload): Promise<void> {
    const existingJob = await this.doclingCrawlingQueue.getJob(payload.documentId)
    if (existingJob) {
      const state = await existingJob.getState()
      if (state === "active") {
        this.logger.warn(
          `Crawl job for document ${payload.documentId} is already running — skipping duplicate enqueue`,
        )
        return
      }
      await existingJob.remove()
    }

    this.logger.log(`Enqueuing Docling URL crawl job ${JSON.stringify(payload)}`)
    await this.doclingCrawlingQueue.add(DOCLING_CRAWLING_JOB_NAME, payload, {
      jobId: payload.documentId,
    })
  }

  async cancelCrawlUrl({ documentId }: { documentId: string }): Promise<void> {
    const job = await this.doclingCrawlingQueue.getJob(documentId)
    if (!job) return

    const state = await job.getState()
    if (state !== "waiting" && state !== "delayed") return

    this.logger.log(`Removing pending crawl job for document ${documentId} (job ${job.id})`)
    await job.remove()
  }
}

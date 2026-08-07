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
    this.logger.log(`Enqueuing Docling URL crawl job ${JSON.stringify(payload)}`)
    await this.doclingCrawlingQueue.add(DOCLING_CRAWLING_JOB_NAME, payload)
  }

  async cancelCrawlUrl({ documentId }: { documentId: string }): Promise<void> {
    const jobs = await this.doclingCrawlingQueue.getJobs(["waiting", "delayed", "paused"])
    for (const job of jobs) {
      if (job.data.documentId === documentId) {
        this.logger.log(`Removing pending crawl job for document ${documentId} (job ${job.id})`)
        await job.remove()
      }
    }
  }
}

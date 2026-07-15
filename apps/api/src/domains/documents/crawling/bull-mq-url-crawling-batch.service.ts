import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import { URL_CRAWLING_JOB_NAME, URL_CRAWLING_QUEUE_NAME } from "./url-crawling.constants"
import type { CrawlUrlJobPayload } from "./url-crawling.types"

@Injectable()
export class BullMqUrlCrawlingBatchService {
  private readonly logger = new Logger(BullMqUrlCrawlingBatchService.name)

  constructor(
    @InjectQueue(URL_CRAWLING_QUEUE_NAME)
    private readonly urlCrawlingQueue: Queue<CrawlUrlJobPayload>,
  ) {}

  async enqueueCrawlUrl(payload: CrawlUrlJobPayload): Promise<void> {
    this.logger.log(`Enqueuing URL crawl job ${JSON.stringify(payload)}`)
    await this.urlCrawlingQueue.add(URL_CRAWLING_JOB_NAME, payload)
  }

  async cancelCrawlUrl({ documentId }: { documentId: string }): Promise<void> {
    const jobs = await this.urlCrawlingQueue.getJobs(["waiting", "delayed", "paused"])
    for (const job of jobs) {
      if (job.data.documentId === documentId) {
        this.logger.log(`Removing pending crawl job for document ${documentId} (job ${job.id})`)
        await job.remove()
      }
    }
  }
}

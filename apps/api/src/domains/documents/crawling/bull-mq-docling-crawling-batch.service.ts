import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DoclingCrawlGenerationService } from "./docling-crawl-generation.service"
import {
  DOCLING_CRAWLING_JOB_NAME,
  DOCLING_CRAWLING_QUEUE_NAME,
} from "./docling-crawling.constants"
import type {
  CrawlUrlDoclingEnqueueRequest,
  CrawlUrlDoclingJobPayload,
} from "./docling-crawling.types"

@Injectable()
export class BullMqDoclingCrawlingBatchService {
  private readonly logger = new Logger(BullMqDoclingCrawlingBatchService.name)

  constructor(
    @InjectQueue(DOCLING_CRAWLING_QUEUE_NAME)
    private readonly doclingCrawlingQueue: Queue<CrawlUrlDoclingJobPayload>,
    private readonly generationService: DoclingCrawlGenerationService,
  ) {}

  async enqueueCrawlUrl(payload: CrawlUrlDoclingEnqueueRequest): Promise<void> {
    const generation = await this.generationService.bumpGeneration(payload.documentId)

    const existingJob = await this.doclingCrawlingQueue.getJob(payload.documentId)
    if (existingJob) {
      const state = await existingJob.getState()
      if (state === "active") {
        this.logger.warn(
          `Crawl job for document ${payload.documentId} is already running — skipping duplicate enqueue (generation bumped to ${generation})`,
        )
        return
      }
      await existingJob.remove()
    }

    const jobPayload: CrawlUrlDoclingJobPayload = { ...payload, generation }
    this.logger.log(`Enqueuing Docling URL crawl job ${JSON.stringify(jobPayload)}`)
    await this.doclingCrawlingQueue.add(DOCLING_CRAWLING_JOB_NAME, jobPayload, {
      jobId: payload.documentId,
    })
  }

  async cancelCrawlUrl({ documentId }: { documentId: string }): Promise<void> {
    await this.generationService.bumpGeneration(documentId)

    const job = await this.doclingCrawlingQueue.getJob(documentId)
    if (!job) return

    const state = await job.getState()
    if (state !== "waiting" && state !== "delayed") return

    this.logger.log(`Removing pending crawl job for document ${documentId} (job ${job.id})`)
    await job.remove()
  }
}

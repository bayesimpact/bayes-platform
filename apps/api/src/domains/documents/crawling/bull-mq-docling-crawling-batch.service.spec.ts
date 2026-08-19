import type { Queue } from "bullmq"
import { BullMqDoclingCrawlingBatchService } from "./bull-mq-docling-crawling-batch.service"
import type { DoclingCrawlGenerationService } from "./docling-crawl-generation.service"
import { DOCLING_CRAWLING_JOB_NAME } from "./docling-crawling.constants"
import type {
  CrawlUrlDoclingEnqueueRequest,
  CrawlUrlDoclingJobPayload,
} from "./docling-crawling.types"

const payload: CrawlUrlDoclingEnqueueRequest = {
  documentId: "doc-1",
  url: "https://example.com",
  organizationId: "org-1",
  projectId: "project-1",
  requestedByUserId: "user-1",
  currentTraceId: "trace-1",
}

describe("BullMqDoclingCrawlingBatchService", () => {
  let service: BullMqDoclingCrawlingBatchService
  let doclingCrawlingQueue: { add: jest.Mock; getJob: jest.Mock }
  let generationService: { bumpGeneration: jest.Mock; isSuperseded: jest.Mock }

  beforeEach(() => {
    doclingCrawlingQueue = { add: jest.fn(), getJob: jest.fn() }
    generationService = {
      bumpGeneration: jest.fn().mockResolvedValue(1),
      isSuperseded: jest.fn().mockResolvedValue(false),
    }
    service = new BullMqDoclingCrawlingBatchService(
      doclingCrawlingQueue as unknown as Queue<CrawlUrlDoclingJobPayload>,
      generationService as unknown as DoclingCrawlGenerationService,
    )
  })

  describe("enqueueCrawlUrl", () => {
    it("adds a job with a deterministic jobId and the bumped generation when none exists yet", async () => {
      doclingCrawlingQueue.getJob.mockResolvedValue(undefined)
      generationService.bumpGeneration.mockResolvedValue(3)

      await service.enqueueCrawlUrl(payload)

      expect(generationService.bumpGeneration).toHaveBeenCalledWith(payload.documentId)
      expect(doclingCrawlingQueue.add).toHaveBeenCalledWith(
        DOCLING_CRAWLING_JOB_NAME,
        { ...payload, generation: 3 },
        { jobId: payload.documentId },
      )
    })

    it("removes a stale completed job before re-enqueueing", async () => {
      const existingJob = {
        getState: jest.fn().mockResolvedValue("completed"),
        remove: jest.fn().mockResolvedValue(undefined),
      }
      doclingCrawlingQueue.getJob.mockResolvedValue(existingJob)

      await service.enqueueCrawlUrl(payload)

      expect(existingJob.remove).toHaveBeenCalledTimes(1)
      expect(doclingCrawlingQueue.add).toHaveBeenCalledWith(
        DOCLING_CRAWLING_JOB_NAME,
        { ...payload, generation: 1 },
        { jobId: payload.documentId },
      )
    })

    it("bumps the generation and skips enqueueing when a job for the document is already active", async () => {
      const existingJob = {
        getState: jest.fn().mockResolvedValue("active"),
        remove: jest.fn(),
      }
      doclingCrawlingQueue.getJob.mockResolvedValue(existingJob)

      await service.enqueueCrawlUrl(payload)

      expect(generationService.bumpGeneration).toHaveBeenCalledWith(payload.documentId)
      expect(existingJob.remove).not.toHaveBeenCalled()
      expect(doclingCrawlingQueue.add).not.toHaveBeenCalled()
    })
  })

  describe("cancelCrawlUrl", () => {
    it("bumps the generation even when no job exists for the document", async () => {
      doclingCrawlingQueue.getJob.mockResolvedValue(undefined)

      await expect(service.cancelCrawlUrl({ documentId: "doc-1" })).resolves.toBeUndefined()

      expect(generationService.bumpGeneration).toHaveBeenCalledWith("doc-1")
    })

    it("bumps the generation and removes a waiting job", async () => {
      const job = {
        id: "job-1",
        getState: jest.fn().mockResolvedValue("waiting"),
        remove: jest.fn().mockResolvedValue(undefined),
      }
      doclingCrawlingQueue.getJob.mockResolvedValue(job)

      await service.cancelCrawlUrl({ documentId: "doc-1" })

      expect(generationService.bumpGeneration).toHaveBeenCalledWith("doc-1")
      expect(job.remove).toHaveBeenCalledTimes(1)
    })

    it("bumps the generation but does not remove a job that is already active", async () => {
      const job = {
        id: "job-1",
        getState: jest.fn().mockResolvedValue("active"),
        remove: jest.fn(),
      }
      doclingCrawlingQueue.getJob.mockResolvedValue(job)

      await service.cancelCrawlUrl({ documentId: "doc-1" })

      expect(generationService.bumpGeneration).toHaveBeenCalledWith("doc-1")
      expect(job.remove).not.toHaveBeenCalled()
    })
  })
})

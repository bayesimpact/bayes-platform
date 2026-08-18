jest.mock("@/external/docling-crawler/docling-crawler-client.service", () => ({
  DoclingCrawlerClientService: jest.fn(),
}))

import { DoclingCrawlingProcessorService } from "./docling-crawling-processor.service"

describe("DoclingCrawlingProcessorService", () => {
  const payload = {
    documentId: "doc-1",
    url: "https://example.com",
    organizationId: "org-1",
    projectId: "project-1",
    requestedByUserId: "user-1",
    currentTraceId: "trace-1",
  }

  const buildService = (
    overrides: {
      crawledPages?: { url: string; markdown: string }[]
      embeddingStatus?: string
      crawlError?: Error
    } = {},
  ) => {
    const doclingCrawlerClientService = {
      crawlUrl: overrides.crawlError
        ? jest.fn().mockRejectedValue(overrides.crawlError)
        : jest.fn().mockResolvedValue(overrides.crawledPages ?? []),
    }
    const documentsService = {
      findById: jest.fn().mockResolvedValue({ embeddingStatus: overrides.embeddingStatus }),
      updateContent: jest.fn().mockResolvedValue(undefined),
      updateEmbeddingStatus: jest.fn().mockResolvedValue(undefined),
    }
    const embeddingStatusNotifierService = {
      notifyEmbeddingStatusChanged: jest.fn().mockResolvedValue(undefined),
    }
    const crawlProgressNotifierService = {
      notifyCrawlProgress: jest.fn().mockResolvedValue(undefined),
    }
    const embeddingsBatchService = {
      enqueueCreateEmbeddingsForDocument: jest.fn().mockResolvedValue(undefined),
    }

    const service = new DoclingCrawlingProcessorService(
      doclingCrawlerClientService as never,
      documentsService as never,
      embeddingStatusNotifierService as never,
      crawlProgressNotifierService as never,
      embeddingsBatchService as never,
    )

    return {
      service,
      doclingCrawlerClientService,
      documentsService,
      embeddingStatusNotifierService,
      embeddingsBatchService,
    }
  }

  it("saves crawled content and enqueues embeddings on success", async () => {
    const { service, documentsService, embeddingsBatchService } = buildService({
      crawledPages: [{ url: "https://example.com", markdown: "# Hello" }],
    })

    await service.processCrawlJob(payload)

    expect(documentsService.updateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: payload.documentId,
        content: JSON.stringify([{ url: "https://example.com", markdown: "# Hello" }]),
      }),
    )
    expect(embeddingsBatchService.enqueueCreateEmbeddingsForDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: payload.documentId,
        origin: "web-crawl",
      }),
    )
  })

  it("skips saving content if the crawl was cancelled", async () => {
    const { service, documentsService, embeddingsBatchService } = buildService({
      crawledPages: [{ url: "https://example.com", markdown: "# Hello" }],
      embeddingStatus: "failed",
    })

    await service.processCrawlJob(payload)

    expect(documentsService.updateContent).not.toHaveBeenCalled()
    expect(embeddingsBatchService.enqueueCreateEmbeddingsForDocument).not.toHaveBeenCalled()
  })

  it("marks the document as failed and rethrows when the crawl returns zero pages", async () => {
    const { service, documentsService, embeddingStatusNotifierService } = buildService({
      crawledPages: [],
    })

    await expect(service.processCrawlJob(payload)).rejects.toThrow(/produced no pages/)

    expect(documentsService.updateEmbeddingStatus).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: payload.documentId, status: "failed" }),
    )
    expect(embeddingStatusNotifierService.notifyEmbeddingStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: payload.documentId, embeddingStatus: "failed" }),
    )
  })

  it("marks the document as failed and rethrows when the crawl errors", async () => {
    const crawlError = new Error("crawl failed")
    const { service, documentsService, embeddingStatusNotifierService } = buildService({
      crawlError,
    })

    await expect(service.processCrawlJob(payload)).rejects.toThrow(crawlError)

    expect(documentsService.updateEmbeddingStatus).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: payload.documentId, status: "failed" }),
    )
    expect(embeddingStatusNotifierService.notifyEmbeddingStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: payload.documentId, embeddingStatus: "failed" }),
    )
  })
})

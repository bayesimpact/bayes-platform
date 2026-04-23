import { Inject, Injectable, Logger } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { SpiderClientService } from "@/external/spider/spider-client.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
import type { CrawlUrlJobPayload } from "./url-crawling.types"
import {
  WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE,
  type WebSourceEmbeddingsBatchService,
} from "./web-source-embeddings-batch.interface"

@Injectable()
export class UrlCrawlingProcessorService {
  private readonly logger = new Logger(UrlCrawlingProcessorService.name)

  constructor(
    private readonly spiderClientService: SpiderClientService,
    private readonly documentsService: DocumentsService,
    private readonly embeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
    @Inject(WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE)
    private readonly embeddingsBatchService: WebSourceEmbeddingsBatchService,
  ) {}

  async processCrawlJob(payload: CrawlUrlJobPayload): Promise<void> {
    this.logger.log(`Processing full-site crawl job for ${payload.url}`)

    const connectScope = {
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    }

    try {
      const pages = await this.spiderClientService.crawlUrl({ url: payload.url })

      this.logger.log(`Crawled ${pages.length} pages from ${payload.url}`)

      const contentPages = pages.map((page) => ({
        url: page.url,
        markdown: page.markdown,
      }))
      const contentJson = JSON.stringify(contentPages)

      await this.documentsService.updateContent({
        connectScope,
        documentId: payload.documentId,
        content: contentJson,
        size: Buffer.byteLength(contentJson, "utf-8"),
      })

      await this.embeddingsBatchService.enqueueCreateEmbeddingsForDocument({
        documentId: payload.documentId,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        uploadedByUserId: payload.requestedByUserId,
        origin: "web-crawl",
        currentTraceId: payload.currentTraceId,
      })

      this.logger.log(
        `Updated document ${payload.documentId} with ${pages.length} pages crawled at ${payload.url}`,
      )
    } catch (error) {
      this.logger.error(`Crawl failed for ${payload.url}: ${(error as Error).message}`)
      try {
        const failed = await this.documentsService.updateEmbeddingStatus({
          connectScope,
          documentId: payload.documentId,
          status: "failed",
        })
        await this.embeddingStatusNotifierService.notifyEmbeddingStatusChanged({
          documentId: failed.id,
          organizationId: failed.organizationId,
          projectId: failed.projectId,
          embeddingStatus: failed.embeddingStatus,
          updatedAt: failed.updatedAt.getTime(),
        })
      } catch (notifyError) {
        this.logger.error(
          `Failed to mark document ${payload.documentId} as failed: ${(notifyError as Error).message}`,
        )
      }
      throw error
    }
  }
}

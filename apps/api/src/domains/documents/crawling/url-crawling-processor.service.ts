import { Inject, Injectable, Logger } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { SpiderClientService } from "@/external/spider/spider-client.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentCrawlProgressNotifierService } from "./document-crawl-progress-notifier.service"
import type { CrawlUrlJobPayload } from "./url-crawling.types"
import {
  WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE,
  type WebSourceEmbeddingsBatchService,
} from "./web-source-embeddings-batch.interface"

const PROGRESS_LOG_INTERVAL = 25

@Injectable()
export class UrlCrawlingProcessorService {
  private readonly logger = new Logger(UrlCrawlingProcessorService.name)

  constructor(
    private readonly spiderClientService: SpiderClientService,
    private readonly documentsService: DocumentsService,
    private readonly embeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
    private readonly crawlProgressNotifierService: DocumentCrawlProgressNotifierService,
    @Inject(WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE)
    private readonly embeddingsBatchService: WebSourceEmbeddingsBatchService,
  ) {}

  async processCrawlJob(payload: CrawlUrlJobPayload): Promise<void> {
    const tag = `[doc:${payload.documentId}]`
    this.logger.log(`${tag} Started crawl for ${payload.url}`)

    const connectScope = {
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    }

    let pagesCrawled = 0
    const startedAt = Date.now()

    try {
      const pages = await this.spiderClientService.crawlUrl({
        url: payload.url,
        onPage: () => {
          pagesCrawled += 1

          if (pagesCrawled % PROGRESS_LOG_INTERVAL === 0) {
            this.logger.log(`${tag} Progress: ${pagesCrawled} pages crawled from ${payload.url}`)
          }

          this.crawlProgressNotifierService
            .notifyCrawlProgress({
              documentId: payload.documentId,
              organizationId: payload.organizationId,
              projectId: payload.projectId,
              pagesCrawled,
              updatedAt: Date.now(),
            })
            .catch((error) => {
              this.logger.error(
                `${tag} Failed to emit crawl progress: ${(error as Error).message}`,
              )
            })
        },
      })

      const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
      this.logger.log(
        `${tag} Crawl complete: ${pages.length} pages in ${durationSeconds}s — storing content`,
      )

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

      this.logger.log(`${tag} Embeddings enqueued for ${pages.length} pages`)
    } catch (error) {
      const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
      this.logger.error(
        `${tag} Crawl failed after ${durationSeconds}s at ${payload.url}: ${(error as Error).message}`,
        (error as Error).stack,
      )
      try {
        await this.documentsService.updateEmbeddingStatus({
          connectScope,
          documentId: payload.documentId,
          status: "failed",
        })
        await this.embeddingStatusNotifierService.notifyEmbeddingStatusChanged({
          documentId: payload.documentId,
          organizationId: payload.organizationId,
          projectId: payload.projectId,
          embeddingStatus: "failed",
          embeddingError: null,
          updatedAt: Date.now(),
        })
      } catch (notifyError) {
        this.logger.error(
          `${tag} Failed to mark document as failed: ${(notifyError as Error).message}`,
        )
      }
      throw error
    }
  }
}

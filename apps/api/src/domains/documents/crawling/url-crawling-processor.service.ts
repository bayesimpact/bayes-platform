import { Inject, Injectable, Logger } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { SpiderClientService } from "@/external/spider/spider-client.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
import {
  DOCUMENT_EMBEDDINGS_BATCH_SERVICE,
  type DocumentEmbeddingsBatchService,
} from "../embeddings/document-embeddings-batch.interface"
import type { CrawlUrlJobPayload } from "./url-crawling.types"

@Injectable()
export class UrlCrawlingProcessorService {
  private readonly logger = new Logger(UrlCrawlingProcessorService.name)

  constructor(
    private readonly spiderClientService: SpiderClientService,
    private readonly documentsService: DocumentsService,
    @Inject(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
    private readonly embeddingsBatchService: DocumentEmbeddingsBatchService,
  ) {}

  async processCrawlJob(payload: CrawlUrlJobPayload): Promise<void> {
    this.logger.log(`Processing crawl job for ${payload.url} (limit: ${payload.limit})`)

    const pages = await this.spiderClientService.crawlUrl({
      url: payload.url,
      limit: payload.limit,
    })

    this.logger.log(`Crawled ${pages.length} pages from ${payload.url}`)

    const connectScope = {
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    }

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
  }
}

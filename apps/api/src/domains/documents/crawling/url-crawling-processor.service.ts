import { randomUUID } from "node:crypto"
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

    const documentId = randomUUID()

    const document = await this.documentsService.createDocument({
      connectScope,
      documentId,
      uploadStatus: "uploaded",
      fields: {
        title: payload.url,
        content: contentJson,
        mimeType: "text/html",
        sourceType: "webCrawl",
        size: Buffer.byteLength(contentJson, "utf-8"),
        fileName: null as unknown as string,
        storageRelativePath: null as unknown as string,
      },
    })

    await this.embeddingsBatchService.enqueueCreateEmbeddingsForDocument({
      documentId: document.id,
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      uploadedByUserId: payload.requestedByUserId,
      origin: "web-crawl",
      currentTraceId: payload.currentTraceId,
    })

    this.logger.log(
      `Created document ${document.id} from ${pages.length} pages crawled at ${payload.url}`,
    )
  }
}

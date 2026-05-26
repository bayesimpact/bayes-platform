import {
  type DocumentCrawlProgressChangedEventDto,
  DocumentsRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Request,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import type { Observable } from "rxjs"
import { filter, map } from "rxjs"
import { v4 } from "uuid"
import type {
  EndpointRequestWithDocument,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { DocumentsGuard } from "../documents.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentCrawlProgressStreamService } from "./document-crawl-progress-stream.service"
import {
  URL_CRAWLING_BATCH_SERVICE,
  type UrlCrawlingBatchService,
} from "./url-crawling-batch.interface"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, DocumentsGuard)
@RequireContext("organization", "project")
@Controller()
export class CrawlingController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentEmbeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
    private readonly documentCrawlProgressStreamService: DocumentCrawlProgressStreamService,
    @Inject(URL_CRAWLING_BATCH_SERVICE)
    private readonly urlCrawlingBatchService: UrlCrawlingBatchService,
  ) {}

  @CheckPolicy((policy) => policy.canCreate())
  @Post(DocumentsRoutes.crawlUrl.path)
  @TrackActivity({ action: "document.crawlUrl" })
  @HttpCode(HttpStatus.ACCEPTED)
  async crawlUrl(
    @Body() { payload }: typeof DocumentsRoutes.crawlUrl.request,
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof DocumentsRoutes.crawlUrl.response> {
    try {
      new URL(payload.url)
    } catch {
      throw new UnprocessableEntityException("Invalid URL.")
    }

    const connectScope = getRequiredConnectScope(req)

    const documentId = v4()
    await this.documentsService.createDocument({
      connectScope,
      documentId,
      uploadStatus: "uploaded",
      fields: {
        title: payload.name ?? payload.url,
        mimeType: "text/html",
        sourceType: "webCrawl",
        sourceUrl: payload.url,
        size: 0,
        fileName: null as unknown as string,
        storageRelativePath: null as unknown as string,
      },
    })

    await this.urlCrawlingBatchService.enqueueCrawlUrl({
      documentId,
      url: payload.url,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      requestedByUserId: req.user.id,
      currentTraceId: v4(),
    })

    return {
      data: {
        message: `Crawling ${payload.url}. Documents will appear as they are processed.`,
      },
    }
  }

  @CheckPolicy((policy) => policy.canUpdate())
  @Post(DocumentsRoutes.reCrawlUrl.path)
  @TrackActivity({ action: "document.reCrawlUrl", entityFrom: "document" })
  @AddContext("document")
  @HttpCode(HttpStatus.ACCEPTED)
  async reCrawlUrl(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.reCrawlUrl.response> {
    const document = req.document

    if (document.sourceType !== "webCrawl") {
      throw new UnprocessableEntityException("Document is not a web crawl source.")
    }

    if (!document.sourceUrl) {
      throw new UnprocessableEntityException(
        "Source URL not available for this document. Please delete it and crawl the website again.",
      )
    }

    const urlToRecrawl = document.sourceUrl

    const connectScope = getRequiredConnectScope(req)

    await this.documentsService.resetForRecrawl({
      connectScope,
      documentId: document.id,
    })

    await this.documentEmbeddingStatusNotifierService.notifyEmbeddingStatusChanged({
      documentId: document.id,
      organizationId: document.organizationId,
      projectId: document.projectId,
      embeddingStatus: "pending",
      embeddingError: null,
      updatedAt: Date.now(),
    })

    await this.urlCrawlingBatchService.enqueueCrawlUrl({
      documentId: document.id,
      url: urlToRecrawl,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      requestedByUserId: req.user.id,
      currentTraceId: v4(),
    })

    return {
      data: {
        message: `Re-crawling ${urlToRecrawl}. Pages will be updated as they are processed.`,
      },
    }
  }

  @CheckPolicy((policy) => policy.canList())
  @Sse(DocumentsRoutes.streamCrawlProgress.path, { method: 0 /* GET */ })
  streamCrawlProgress(
    @Request() req: EndpointRequestWithProject,
  ): Observable<DocumentCrawlProgressChangedEventDto> {
    const connectScope = getRequiredConnectScope(req)
    return this.documentCrawlProgressStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }
}

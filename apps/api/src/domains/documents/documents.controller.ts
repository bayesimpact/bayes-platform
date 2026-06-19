import {
  type DocumentCrawlProgressChangedEventDto,
  type DocumentDto,
  type DocumentEmbeddingStatusChangedEventDto,
  type DocumentSourceType,
  DocumentsRoutes,
  isAllowedMimeType,
  type MimeTypes,
  type PresignFileResponseItemDto,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
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
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentCrawlProgressStreamService } from "./crawling/document-crawl-progress-stream.service"
import {
  URL_CRAWLING_BATCH_SERVICE,
  type UrlCrawlingBatchService,
} from "./crawling/url-crawling-batch.interface"
import type { Document } from "./document.entity"
import { DocumentsGuard } from "./documents.guard"
import {
  extractFileExtension,
  isPublicDocument,
  normalizeUploadedFileName,
} from "./documents.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "./documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "./embeddings/document-embedding-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusStreamService } from "./embeddings/document-embedding-status-stream.service"
import {
  DOCUMENT_EMBEDDINGS_BATCH_SERVICE,
  type DocumentEmbeddingsBatchService,
} from "./embeddings/document-embeddings-batch.interface"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "./storage/file-storage.interface"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, DocumentsGuard)
@RequireContext("organization", "project")
@Controller()
export class DocumentsController {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    @Inject(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
    private readonly documentEmbeddingsBatchService: DocumentEmbeddingsBatchService,
    @Inject(URL_CRAWLING_BATCH_SERVICE)
    private readonly urlCrawlingBatchService: UrlCrawlingBatchService,
    private readonly documentsService: DocumentsService,
    private readonly documentEmbeddingStatusStreamService: DocumentEmbeddingStatusStreamService,
    private readonly documentCrawlProgressStreamService: DocumentCrawlProgressStreamService,
    private readonly documentEmbeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
  ) {}

  @CheckPolicy((policy) => policy.canCreate())
  @Post(DocumentsRoutes.presignMany.path)
  @HttpCode(HttpStatus.CREATED)
  async presignMany(
    @Body() { payload }: typeof DocumentsRoutes.presignMany.request,
    @Request() req: EndpointRequestWithProject,
    @Param("sourceType") sourceType: DocumentSourceType,
  ): Promise<typeof DocumentsRoutes.presignMany.response> {
    if (!sourceType) {
      throw new UnprocessableEntityException("Source type is required.")
    }
    if (!payload.files || payload.files.length === 0) {
      throw new UnprocessableEntityException("At least one file is required.")
    }

    const connectScope = getRequiredConnectScope(req)
    const results: PresignFileResponseItemDto[] = []

    for (const fileInfo of payload.files) {
      if (!fileInfo.mimeType) {
        throw new UnprocessableEntityException("File MIME type is required.")
      }
      if (!isAllowedMimeType(fileInfo.mimeType)) {
        throw new UnprocessableEntityException(
          `Invalid file type: ${fileInfo.mimeType}. Allowed types: PDF, Microsoft Office (Word, Excel, PowerPoint), images (PNG, JPEG, TIFF, BMP, WebP), CSV, or plain text.`,
        )
      }

      const normalizedFileName = normalizeUploadedFileName(fileInfo.fileName)
      const extension = extractFileExtension(normalizedFileName)

      const documentId = v4()
      const storagePath = this.fileStorageService.buildStorageRelativePath({
        connectScope,
        documentId,
        extension,
      })

      const uploadUrl = await this.fileStorageService.generateSignedUploadUrl({
        storagePath,
        mimeType: fileInfo.mimeType,
        expiresInSeconds: 900, // 15 minutes
      })

      await this.documentsService.createDocument({
        uploadStatus: "pending",
        connectScope,
        documentId,
        fields: {
          fileName: normalizedFileName,
          mimeType: fileInfo.mimeType,
          size: fileInfo.size,
          storageRelativePath: storagePath,
          title: normalizedFileName,
          sourceType,
        },
        userId: req.user.id,
      })

      results.push({ documentId, uploadUrl })
    }

    return { data: results }
  }

  // FIXME: the polilcy is not correct here
  // needed for /app/ (not admin/owner to upload doc in agent extraction)
  @CheckPolicy((policy) => policy.canView())
  @Post(DocumentsRoutes.confirmMany.path)
  @TrackActivity({ action: "document.createMany" })
  @HttpCode(HttpStatus.CREATED)
  async confirmMany(
    @Body() { payload }: typeof DocumentsRoutes.confirmMany.request,
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof DocumentsRoutes.confirmMany.response> {
    if (!payload.documentIds || payload.documentIds.length === 0) {
      throw new UnprocessableEntityException("At least one document ID is required.")
    }

    const connectScope = getRequiredConnectScope(req)
    const documents: Document[] = []

    const tagIds =
      payload.tagIds !== undefined && payload.tagIds.length > 0 ? payload.tagIds : undefined

    for (const documentId of payload.documentIds) {
      await this.documentsService.markAsUploaded({ connectScope, documentId })

      let document: Document
      if (tagIds !== undefined) {
        document = await this.documentsService.updateDocument({
          connectScope,
          documentId,
          fieldsToUpdate: { tagsToAdd: tagIds },
        })
      } else {
        const found = await this.documentsService.findById({ connectScope, documentId })
        if (!found) throw new NotFoundException(`Document ${documentId} not found`)
        document = found
      }

      if (document.sourceType === "project") {
        const embeddingPatch =
          await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
            documentId: document.id,
            organizationId: connectScope.organizationId,
            projectId: connectScope.projectId,
            uploadedByUserId: req.user.id,
            origin: "document-upload",
            currentTraceId: v4(),
          })
        document.embeddingStatus = embeddingPatch.embeddingStatus
        document.embeddingError = embeddingPatch.embeddingError
        document.updatedAt = embeddingPatch.updatedAt
      }
      documents.push(document)
    }

    return { data: documents.map(toDocumentDto) }
  }

  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("document")
  @Post(DocumentsRoutes.reprocessOne.path)
  async reprocessOne(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.reprocessOne.response> {
    const document = req.document
    if (document.sourceType !== "project") {
      throw new UnprocessableEntityException("Only project documents can be reprocessed.")
    }
    if (document.embeddingStatus !== "failed") {
      throw new UnprocessableEntityException("Only failed documents can be reprocessed.")
    }

    const connectScope = getRequiredConnectScope(req)
    await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
      documentId: document.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      uploadedByUserId: req.user.id,
      origin: "document-upload",
      currentTraceId: v4(),
    })

    return { data: { success: true } }
  }

  @CheckPolicy((policy) => policy.canList())
  @Get(DocumentsRoutes.getAll.path)
  async getAll(
    @Request() req: EndpointRequestWithProject,
    @Param("sourceType") sourceType: DocumentSourceType,
  ): Promise<typeof DocumentsRoutes.getAll.response> {
    const documents = await this.documentsService.listDocuments(
      getRequiredConnectScope(req),
      sourceType,
    )
    return { data: documents.map(toDocumentDto) }
  }

  @CheckPolicy((policy) => policy.canView())
  @Get(DocumentsRoutes.listMyExtractionDocuments.path)
  async listMyExtractionDocuments(
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof DocumentsRoutes.listMyExtractionDocuments.response> {
    const documents = await this.documentsService.listExtractionDocumentsForUser({
      connectScope: getRequiredConnectScope(req),
      userId: req.user.id,
    })
    return { data: documents.map(toDocumentDto) }
  }

  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("document")
  @Patch(DocumentsRoutes.updateOne.path)
  @TrackActivity({ action: "document.update", entityFrom: "document" })
  async updateOne(
    @Request() req: EndpointRequestWithDocument,
    @Body() { payload }: typeof DocumentsRoutes.updateOne.request,
  ): Promise<typeof DocumentsRoutes.updateOne.response> {
    await this.documentsService.updateDocument({
      connectScope: getRequiredConnectScope(req),
      documentId: req.document.id,
      fieldsToUpdate: payload,
    })

    return { data: { success: true } }
  }

  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("document")
  @Delete(DocumentsRoutes.deleteOne.path)
  @TrackActivity({ action: "document.delete", entityFrom: "document" })
  async deleteOne(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.deleteOne.response> {
    const documentId = req.document.id

    await this.documentsService.deleteDocument({
      connectScope: getRequiredConnectScope(req),
      documentId,
    })

    return { data: { success: true } }
  }

  // Admins/owners can download any document; regular members only documents
  // tagged `public-documents` (see DocumentPolicy.canDownload). The document is
  // loaded with its tags by DocumentContextResolver so the policy can enforce this.
  @CheckPolicy((policy) => policy.canDownload())
  @AddContext("document")
  @Get(DocumentsRoutes.getTemporaryUrl.path)
  @HttpCode(HttpStatus.CREATED)
  async getTemporaryUrl(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.getTemporaryUrl.response> {
    const document = req.document

    const url = await this.fileStorageService.getTemporaryUrl(document.storageRelativePath)
    if (!url) {
      throw new NotFoundException("Temporary URL not found for the document.")
    }
    return { data: { url } }
  }

  // Reports whether a document is tagged `public-documents`. Drives the download
  // affordance for chat sources without trusting a value copied by the LLM. Any
  // project member can call it (canView) since it exposes only a boolean.
  @CheckPolicy((policy) => policy.canView())
  @AddContext("document")
  @Get(DocumentsRoutes.getIsPublic.path)
  async getIsPublic(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.getIsPublic.response> {
    return { data: { isPublicDocument: isPublicDocument(req.document) } }
  }

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
  @Sse(DocumentsRoutes.streamEmbeddingStatus.path, { method: 0 /* GET */ })
  streamEmbeddingStatus(
    @Request() req: EndpointRequestWithProject,
  ): Observable<DocumentEmbeddingStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(req)
    return this.documentEmbeddingStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
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

function parseCrawledPages(
  content: string | null,
): { url: string; markdown: string }[] | undefined {
  if (!content) return undefined
  try {
    const parsed: unknown = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url && parsed[0].markdown) {
      return parsed as { url: string; markdown: string }[]
    }
  } catch {
    // malformed content
  }
  return undefined
}

function toDocumentDto(entity: Document): DocumentDto {
  const isWebCrawl = entity.sourceType === "webCrawl"
  return {
    content: isWebCrawl ? undefined : entity.content,
    createdAt: entity.createdAt.getTime(),
    deletedAt: entity.deletedAt?.getTime() || undefined,
    embeddingError: entity.embeddingError ?? null,
    embeddingStatus: entity.embeddingStatus,
    fileName: entity.fileName,
    id: entity.id,
    language: entity.language === "fr" ? "fr" : "en",
    mimeType: entity.mimeType as MimeTypes,
    pages: isWebCrawl ? parseCrawledPages(entity.content) : undefined,
    projectId: entity.projectId,
    size: entity.size,
    sourceType: entity.sourceType,
    sourceUrl: entity.sourceUrl ?? null,
    storageRelativePath: entity.storageRelativePath,
    tagIds: entity.tags?.map((tag) => tag.id) || [],
    title: entity.title,
    updatedAt: entity.updatedAt.getTime(),
  }
}

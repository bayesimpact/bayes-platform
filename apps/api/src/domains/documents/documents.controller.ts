import {
  type DocumentCrawlProgressChangedEventDto,
  type DocumentDto,
  type DocumentEmbeddingStatusChangedEventDto,
  type DocumentSourceType,
  DocumentsRoutes,
  documentUploadAllowedMimeTypePattern,
  isAllowedMimeType,
  type MimeTypes,
  type PresignFileResponseItemDto,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Request,
  Sse,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express/multer"
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
import type { MulterFile } from "@/common/types"
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
  normalizeUploadedFileName,
  parseMultipartTagIdsField,
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

const mega = 1024
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
  @Post(DocumentsRoutes.uploadOne.path)
  @TrackActivity({ action: "document.create" })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  async uploadOne(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * mega * mega }), // 10 MB
          new FileTypeValidator({
            fileType: documentUploadAllowedMimeTypePattern,
            skipMagicNumbersValidation: true,
          }),
        ],
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file: MulterFile,
    @Body()
    body: { tagIds?: unknown } | undefined,
    @Request() req: EndpointRequestWithProject,
    @Param("sourceType") sourceType: DocumentSourceType,
  ): Promise<typeof DocumentsRoutes.uploadOne.response> {
    if (!sourceType) {
      throw new UnprocessableEntityException("Source type is required.")
    }
    if (!file) {
      throw new UnprocessableEntityException("File is required.")
    }
    if (!file.mimetype) {
      throw new UnprocessableEntityException("File MIME type is required.")
    }

    if (!isAllowedMimeType(file.mimetype)) {
      throw new UnprocessableEntityException(
        `Invalid file type: ${file.mimetype}. Allowed types: PDF, Microsoft Office (Word, Excel, PowerPoint), images (PNG, JPEG, TIFF, BMP, WebP), CSV, or plain text.`,
      )
    }

    const normalizedFileName = normalizeUploadedFileName(file.originalname)
    const extension = extractFileExtension(normalizedFileName)
    const connectScope = getRequiredConnectScope(req)
    const fileInfo = await this.fileStorageService.save({ file, connectScope, extension })
    const tagIds = parseMultipartTagIdsField(body?.tagIds)

    const document = await this.documentsService.createDocument({
      uploadStatus: "uploaded",
      connectScope,
      documentId: fileInfo.fileId,
      tagIds,
      fields: {
        fileName: normalizedFileName,
        mimeType: file.mimetype,
        size: file.size,
        storageRelativePath: fileInfo.storageRelativePath,
        title: normalizedFileName,
        sourceType,
      },
      userId: req.user.id,
    })

    if (!document) {
      throw new NotFoundException("Document not found or you do not have permission to access it.")
    }

    if (document.sourceType === "project") {
      await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
        documentId: document.id,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        uploadedByUserId: req.user.id,
        origin: "document-upload",
        currentTraceId: v4(),
      })
    }

    return { data: toDocumentDto(document) }
  }

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

  @CheckPolicy((policy) => policy.canCreate())
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
      let document = await this.documentsService.markAsUploaded({ connectScope, documentId })

      if (tagIds !== undefined) {
        document = await this.documentsService.updateDocument({
          connectScope,
          documentId: document.id,
          fieldsToUpdate: { tagsToAdd: tagIds },
        })
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
  ): Promise<typeof DocumentsRoutes.getAll.response> {
    const documents = await this.documentsService.listDocuments(getRequiredConnectScope(req))
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

  // FIXME: create a dedicated endpoint for every sourceType and check ownership
  // because we can show any doc with its id
  @CheckPolicy((policy) => policy.canView())
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

    const urlToRecrawl =
      document.sourceUrl ?? resolveSourceUrlFallback(document.title, document.content)

    if (!urlToRecrawl) {
      throw new UnprocessableEntityException(
        "Source URL not available for this document. Please delete it and crawl the website again.",
      )
    }

    const connectScope = getRequiredConnectScope(req)

    const reset = await this.documentsService.resetForRecrawl({
      connectScope,
      documentId: document.id,
    })

    await this.documentEmbeddingStatusNotifierService.notifyEmbeddingStatusChanged({
      documentId: reset.id,
      organizationId: reset.organizationId,
      projectId: reset.projectId,
      embeddingStatus: reset.embeddingStatus,
      embeddingError: reset.embeddingError,
      updatedAt: reset.updatedAt.getTime(),
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

function resolveSourceUrlFallback(title: string, content: string | null): string | null {
  // 1. Title may be the original URL if the document was never renamed.
  try {
    new URL(title)
    return title
  } catch {
    // title is an alias, not a URL
  }
  // 2. Extract the shortest URL from crawled content — typically the root entry point.
  if (content) {
    try {
      const pages: { url?: string }[] = JSON.parse(content)
      const urls = pages.map((page) => page.url).filter((url): url is string => Boolean(url))
      if (urls.length > 0) {
        urls.sort((a, b) => a.length - b.length)
        return urls[0] ?? null
      }
    } catch {
      // malformed content
    }
  }
  return null
}

function toDocumentDto(entity: Document): DocumentDto {
  return {
    id: entity.id,
    projectId: entity.projectId,
    title: entity.title,
    content: entity.content,
    fileName: entity.fileName,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
    deletedAt: entity.deletedAt?.getTime() || undefined,
    language: entity.language === "fr" ? "fr" : "en",
    mimeType: entity.mimeType as MimeTypes,
    size: entity.size,
    storageRelativePath: entity.storageRelativePath,
    sourceType: entity.sourceType,
    sourceUrl: entity.sourceUrl ?? null,
    embeddingStatus: entity.embeddingStatus,
    embeddingError: entity.embeddingError ?? null,
    tagIds: entity.tags?.map((tag) => tag.id) || [],
  }
}

import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import {
  type AppDocumentUploadHeadersDto,
  DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER,
  DOCUMENT_UPLOAD_MAX_BYTES,
  documentUploadContentLengthRange,
  isAllowedMimeType,
  MimeTypes,
  type PresignFileRequestItemDto,
  type PresignFileResponseItemDto,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository, UpdateResult } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import { Document } from "./document.entity"
import { extractFileExtension, normalizeUploadedFileName } from "./documents.helpers"
import type { DocumentEmbeddingsBatchService } from "./embeddings/document-embeddings-batch.interface"
import { DOCUMENT_EMBEDDINGS_BATCH_SERVICE } from "./embeddings/document-embeddings-batch.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfPagesService } from "./pdf-pages/pdf-pages.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentSourcesService } from "./sources/document-sources.service"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "./storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "./tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "./tags/document-tags.types"

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    @InjectRepository(Document) private readonly documentRepository: Repository<Document>,
    private readonly documentTagsService: DocumentTagsService,
    private readonly documentSourcesService: DocumentSourcesService,
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: IFileStorage,
    private readonly pdfPagesService: PdfPagesService,
    @Inject(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
    private readonly documentEmbeddingsBatchService: DocumentEmbeddingsBatchService,
  ) {
    this.documentConnectRepository = new ConnectRepository(documentRepository, "documents")
  }
  private readonly documentConnectRepository: ConnectRepository<Document>

  async createDocument({
    connectScope,
    documentId,
    fields,
    userId,
    uploadStatus,
    tagIds,
  }: {
    userId?: string
    connectScope: RequiredConnectScope
    documentId: string
    fields: Pick<
      Document,
      "fileName" | "mimeType" | "size" | "storageRelativePath" | "title" | "sourceType"
    > &
      Partial<Pick<Document, "content" | "sourceUrl" | "documentSourceId">>
    uploadStatus: "pending" | "uploaded"
    tagIds?: string[]
  }): Promise<Document> {
    const document = await this.documentConnectRepository.createAndSave(connectScope, {
      id: documentId,
      fileName: fields.fileName,
      mimeType: fields.mimeType,
      size: fields.size,
      storageRelativePath: fields.storageRelativePath,
      title: fields.title ?? fields.fileName,
      sourceType: fields.sourceType,
      sourceUrl: fields.sourceUrl ?? null,
      documentSourceId: fields.documentSourceId ?? null,
      content: fields.content,
      uploadStatus,
      userId: userId ?? null,
    })

    if (tagIds === undefined || tagIds.length === 0) {
      return document
    }

    document.tags = await this.documentTagsService.resolveTagChanges({
      currentTags: [],
      tagsToAdd: tagIds,
    })

    return this.documentConnectRepository.saveOne(document)
  }

  /**
   * Reserves a document for a browser upload: validates the file type, creates the document as
   * `pending` and returns the signed URL the browser PUTs the bytes to. `markAsUploaded`
   * completes the upload once the bytes are in storage.
   */
  async presignUpload({
    connectScope,
    file,
    sourceType,
    userId,
  }: {
    connectScope: RequiredConnectScope
    file: PresignFileRequestItemDto
    sourceType: Document["sourceType"]
    userId: string
  }): Promise<PresignFileResponseItemDto> {
    if (!file.mimeType) {
      throw new UnprocessableEntityException("File MIME type is required.")
    }
    if (!isAllowedMimeType(file.mimeType)) {
      throw new UnprocessableEntityException(
        `Invalid file type: ${file.mimeType}. Allowed types: PDF, Microsoft Office (Word, Excel, PowerPoint), images (PNG, JPEG, TIFF, BMP, WebP), CSV, plain text, or Markdown.`,
      )
    }

    const normalizedFileName = normalizeUploadedFileName(file.fileName)
    const extension = extractFileExtension(normalizedFileName)

    const documentId = randomUUID()
    const storagePath = this.fileStorageService.buildStorageRelativePath({
      connectScope,
      documentId,
      extension,
    })

    const uploadUrl = await this.fileStorageService.generateSignedUploadUrl({
      storagePath,
      mimeType: file.mimeType,
      expiresInSeconds: 900, // 15 minutes
    })

    await this.createDocument({
      uploadStatus: "pending",
      connectScope,
      documentId,
      fields: {
        fileName: normalizedFileName,
        mimeType: file.mimeType,
        size: file.size,
        storageRelativePath: storagePath,
        title: normalizedFileName,
        sourceType,
      },
      userId,
    })

    return { documentId, uploadUrl }
  }

  async markAsUploaded({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<void> {
    const result: UpdateResult = await this.documentRepository.update(
      {
        id: documentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      { uploadStatus: "uploaded" },
    )
    if (!result.affected) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
  }

  private sortNewestFirst = (a: Document, b: Document) =>
    b.createdAt.getTime() - a.createdAt.getTime()

  async listDocuments(
    connectScope: RequiredConnectScope,
    sourceType: Document["sourceType"],
  ): Promise<Document[]> {
    return (
      await this.documentConnectRepository.find(connectScope, {
        where: [{ sourceType, uploadStatus: "uploaded" }],
        relations: ["tags"],
      })
    )?.sort(this.sortNewestFirst)
  }

  async listBySourceType({
    connectScope,
    sourceType,
  }: {
    connectScope: RequiredConnectScope
    sourceType: Document["sourceType"]
  }): Promise<Document[]> {
    return (
      await this.documentConnectRepository.find(connectScope, {
        where: { sourceType, uploadStatus: "uploaded" },
      })
    )?.sort(this.sortNewestFirst)
  }

  async listExtractionDocumentsForUser({
    connectScope,
    userId,
  }: {
    connectScope: RequiredConnectScope
    userId: string
  }): Promise<Document[]> {
    return (
      await this.documentConnectRepository.find(connectScope, {
        where: { sourceType: "extraction", uploadStatus: "uploaded", userId },
        relations: ["tags"],
      })
    )?.sort(this.sortNewestFirst)
  }

  async findById({
    connectScope,
    documentId,
    withTags = false,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    withTags?: boolean
  }): Promise<Document | null> {
    return await this.documentConnectRepository.getOneById(
      connectScope,
      documentId,
      withTags ? { relations: ["tags"] } : undefined,
    )
  }

  async updateDocument({
    connectScope,
    documentId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    fieldsToUpdate: Partial<Pick<Document, "title">> & DocumentTagsUpdateFields
  }): Promise<Document> {
    const needsTags =
      (fieldsToUpdate.tagsToAdd !== undefined && fieldsToUpdate.tagsToAdd.length > 0) ||
      (fieldsToUpdate.tagsToRemove !== undefined && fieldsToUpdate.tagsToRemove.length > 0)

    const document = await this.documentConnectRepository.getOneById(
      connectScope,
      documentId,
      needsTags ? { relations: ["tags"] } : undefined,
    )
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }

    if (fieldsToUpdate.title !== undefined) {
      document.title = fieldsToUpdate.title
    }

    if (needsTags) {
      document.tags = await this.documentTagsService.resolveTagChanges({
        currentTags: document.tags ?? [],
        tagsToAdd: fieldsToUpdate.tagsToAdd,
        tagsToRemove: fieldsToUpdate.tagsToRemove,
      })
    }

    return this.documentConnectRepository.saveOne(document)
  }

  async updateContent({
    connectScope,
    documentId,
    content,
    size,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    content: string
    size: number
  }): Promise<void> {
    const result: UpdateResult = await this.documentRepository.update(
      {
        id: documentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      { content, size },
    )
    if (!result.affected) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
  }

  async saveOne(document: Document): Promise<Document> {
    return this.documentConnectRepository.saveOne(document)
  }

  /**
   * Caches the rendered page count for a PDF document, so future extraction
   * runs referencing the same document reuse the already-rendered GCS pages
   * instead of asking the pdf-converter service to render again.
   */
  async updatePdfPageCount({
    connectScope,
    documentId,
    pdfPageCount,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    pdfPageCount: number
  }): Promise<void> {
    const { success } = await this.documentConnectRepository.updateOneById({
      connectScope,
      id: documentId,
      fields: { pdfPageCount },
    })
    if (!success) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
  }

  async updateEmbeddingStatus({
    connectScope,
    documentId,
    status,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    status: Document["embeddingStatus"]
  }): Promise<void> {
    const result: UpdateResult = await this.documentRepository.update(
      {
        id: documentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      { embeddingStatus: status },
    )
    if (!result.affected) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
  }

  async resetForRecrawl({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<void> {
    const result: UpdateResult = await this.documentRepository.update(
      {
        id: documentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      { content: null as unknown as string, embeddingStatus: "pending", embeddingError: null },
    )
    if (!result.affected) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
  }

  async deleteDocument({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<true> {
    const document = await this.documentConnectRepository.getOneById(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    const isDeleted = await this.documentConnectRepository.deleteOneById({
      connectScope,
      id: documentId,
    })
    if (!isDeleted) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }

    // Storage cleanup happens after the row is gone: a storage hiccup must not
    // resurrect the document, and a missing object is not an error.
    await this.deleteStoredFiles(document)
    return true
  }

  async createInlineProjectDocument(params: {
    connectScope: RequiredConnectScope
    userId: string
    title: string
    content: string
    sourceUrl?: string | null
    documentSourceId: string
  }): Promise<Document> {
    await this.requireProjectDocumentSource(params.connectScope, params.documentSourceId)
    const buffer = Buffer.from(params.content, "utf8")
    const { fileId, storageRelativePath } = await this.fileStorageService.save({
      extension: "txt",
      connectScope: params.connectScope,
      file: inlineTextFile(params.title, buffer),
    })
    const document = await this.createDocument({
      connectScope: params.connectScope,
      documentId: fileId,
      userId: params.userId,
      uploadStatus: "uploaded",
      fields: {
        title: params.title,
        content: params.content,
        fileName: `${fileId}.txt`,
        mimeType: MimeTypes.txt,
        size: buffer.length,
        storageRelativePath,
        sourceType: "project",
        sourceUrl: params.sourceUrl ?? null,
        documentSourceId: params.documentSourceId,
      },
    })
    const embeddingPatch =
      await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
        documentId: document.id,
        organizationId: params.connectScope.organizationId,
        projectId: params.connectScope.projectId,
        uploadedByUserId: params.userId,
        origin: "document-upload",
        currentTraceId: randomUUID(),
      })
    document.embeddingStatus = embeddingPatch.embeddingStatus
    document.embeddingError = embeddingPatch.embeddingError
    document.updatedAt = embeddingPatch.updatedAt
    return document
  }

  async createPendingProjectDocumentUpload(params: {
    connectScope: RequiredConnectScope
    userId: string
    fileName: string
    mimeType: string
    size: number
    title?: string
    sourceUrl?: string | null
    documentSourceId: string
  }): Promise<{
    document: Document
    uploadUrl: string
    uploadHeaders: AppDocumentUploadHeadersDto
  }> {
    await this.requireProjectDocumentSource(params.connectScope, params.documentSourceId)
    const normalizedFileName = normalizeUploadedFileName(params.fileName)
    const extension = fileExtensionOrBadRequest(normalizedFileName)
    const documentId = randomUUID()
    const storageRelativePath = this.fileStorageService.buildStorageRelativePath({
      connectScope: params.connectScope,
      documentId,
      extension,
    })
    const uploadUrl = await this.fileStorageService.generateSignedUploadUrl({
      storagePath: storageRelativePath,
      mimeType: params.mimeType,
      expiresInSeconds: 900,
      maxBytes: DOCUMENT_UPLOAD_MAX_BYTES,
    })
    const document = await this.createDocument({
      connectScope: params.connectScope,
      documentId,
      userId: params.userId,
      uploadStatus: "pending",
      fields: {
        title: params.title ?? normalizedFileName,
        fileName: normalizedFileName,
        mimeType: params.mimeType,
        size: params.size,
        storageRelativePath,
        sourceType: "project",
        sourceUrl: params.sourceUrl ?? null,
        documentSourceId: params.documentSourceId,
      },
    })
    document.embeddingStatus = document.embeddingStatus ?? "pending"
    return {
      document,
      uploadUrl,
      uploadHeaders: {
        "Content-Type": params.mimeType,
        [DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER]: documentUploadContentLengthRange(),
      },
    }
  }

  async confirmProjectDocumentUpload(params: {
    connectScope: RequiredConnectScope
    userId: string
    documentId: string
  }): Promise<Document> {
    const document = await this.findById({
      connectScope: params.connectScope,
      documentId: params.documentId,
    })
    if (!document) {
      throw new NotFoundException(`Document ${params.documentId} not found`)
    }
    if (document.uploadStatus !== "pending") {
      throw new BadRequestException("Document is not pending")
    }
    const storageRelativePath = document.storageRelativePath
    if (!storageRelativePath || !(await this.fileStorageService.fileExists(storageRelativePath))) {
      throw new BadRequestException("Upload is missing")
    }

    await this.markAsUploaded({
      connectScope: params.connectScope,
      documentId: document.id,
    })
    document.uploadStatus = "uploaded"

    const embeddingPatch =
      await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
        documentId: document.id,
        organizationId: params.connectScope.organizationId,
        projectId: params.connectScope.projectId,
        uploadedByUserId: params.userId,
        origin: "document-upload",
        currentTraceId: randomUUID(),
      })
    document.embeddingStatus = embeddingPatch.embeddingStatus
    document.embeddingError = embeddingPatch.embeddingError
    document.updatedAt = embeddingPatch.updatedAt
    return document
  }

  private async requireProjectDocumentSource(
    connectScope: RequiredConnectScope,
    documentSourceId: string,
  ): Promise<void> {
    const documentSource = await this.documentSourcesService.getOne(connectScope, documentSourceId)
    if (!documentSource) {
      throw new NotFoundException(`Document source ${documentSourceId} not found`)
    }
  }

  /** Removes the source object and every rendered page image of a document from storage. */
  private async deleteStoredFiles(document: Document): Promise<void> {
    // Crawled documents have no stored file: their content lives in the row only.
    if (!document.storageRelativePath) return

    try {
      await Promise.all([
        this.fileStorageService.deleteFile(document.storageRelativePath),
        this.pdfPagesService.deleteRenderedPages({
          document,
          fileStorageService: this.fileStorageService,
        }),
      ])
    } catch (error) {
      this.logger.warn(
        `Could not delete stored files of document ${document.id} (${document.storageRelativePath}): ${(error as Error).message}`,
      )
    }
  }
}

function fileExtensionOrBadRequest(fileName: string): string {
  try {
    return extractFileExtension(fileName)
  } catch {
    throw new BadRequestException("Invalid document payload")
  }
}

function inlineTextFile(title: string, buffer: Buffer): MulterFile {
  return {
    fieldname: "file",
    originalname: `${title}.txt`,
    encoding: "7bit",
    mimetype: MimeTypes.txt,
    size: buffer.length,
    buffer,
    stream: Readable.from(buffer),
    destination: "",
    filename: "",
    path: "",
  }
}

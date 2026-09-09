import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository, UpdateResult } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Document } from "./document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PdfPagesService } from "./pdf-pages/pdf-pages.service"
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
    @Inject(FILE_STORAGE_SERVICE) private readonly fileStorageService: IFileStorage,
    private readonly pdfPagesService: PdfPagesService,
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
      Partial<Pick<Document, "content" | "sourceUrl">>
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

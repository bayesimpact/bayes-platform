import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Document } from "./document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "./tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "./tags/document-tags.types"

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) documentRepository: Repository<Document>,
    private readonly documentTagsService: DocumentTagsService,
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
  }): Promise<Document> {
    const document = await this.documentConnectRepository.getOneById(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    document.uploadStatus = "uploaded"
    return this.documentConnectRepository.saveOne(document)
  }

  private sortNewestFirst = (a: Document, b: Document) =>
    b.createdAt.getTime() - a.createdAt.getTime()

  async listDocuments(connectScope: RequiredConnectScope, sourceType: Document["sourceType"]): Promise<Document[]> {
    return (
      await this.documentConnectRepository.find(connectScope, {
        where: [
          { sourceType, uploadStatus: "uploaded" }
        ],
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

    if (
      fieldsToUpdate.title !== undefined &&
      document.sourceType === "webCrawl" &&
      document.sourceUrl === null
    ) {
      try {
        new URL(document.title)
        document.sourceUrl = document.title
      } catch {
        // title is not a URL (already an alias) — nothing to backfill
      }
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
  }): Promise<Document> {
    const document = await this.documentConnectRepository.getOneById(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    document.content = content
    document.size = size
    return this.documentConnectRepository.saveOne(document)
  }

  async saveOne(document: Document): Promise<Document> {
    return this.documentConnectRepository.saveOne(document)
  }

  async updateEmbeddingStatus({
    connectScope,
    documentId,
    status,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    status: Document["embeddingStatus"]
  }): Promise<Document> {
    const document = await this.documentConnectRepository.getOneById(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    document.embeddingStatus = status
    return this.documentConnectRepository.saveOne(document)
  }

  async resetForRecrawl({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<Document> {
    const document = await this.documentConnectRepository.getOneById(connectScope, documentId)
    if (!document) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    document.content = null as unknown as string
    document.embeddingStatus = "pending"
    document.embeddingError = null
    return this.documentConnectRepository.saveOne(document)
  }

  async deleteDocument({
    connectScope,
    documentId,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
  }): Promise<true> {
    const isDeleted = await this.documentConnectRepository.deleteOneById({
      connectScope,
      id: documentId,
    })
    if (!isDeleted) {
      throw new NotFoundException(`Document with id ${documentId} not found`)
    }
    return true
  }
}

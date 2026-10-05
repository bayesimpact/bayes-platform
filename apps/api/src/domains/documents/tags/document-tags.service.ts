import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { DocumentTag } from "./document-tag.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagRepository } from "./document-tag.repository"
import type { DocumentTagsUpdateFields } from "./document-tags.types"

@Injectable()
export class DocumentTagsService {
  constructor(private readonly documentTagRepository: DocumentTagRepository) {}

  async resolveTagChanges({
    currentTags,
    tagsToAdd = [],
    tagsToRemove = [],
  }: {
    currentTags: DocumentTag[]
  } & DocumentTagsUpdateFields): Promise<DocumentTag[]> {
    const addedTags = await this.documentTagRepository.findByIds(tagsToAdd)
    const tagsToRemoveSet = new Set(tagsToRemove)
    return [...currentTags.filter((tag) => !tagsToRemoveSet.has(tag.id)), ...addedTags]
  }

  // Match the reserved name case-insensitively so that variants like
  // "Public-Documents" cannot be created and silently bypass the reservation
  // (the retrieval query matches the exact lowercase name).
  private isReservedPublicDocumentsName(name: string | undefined): boolean {
    return name?.trim().toLowerCase() === PUBLIC_DOCUMENTS_TAG_NAME
  }

  private async assertParentIsNotPublicDocumentsTag(parentId: string | null | undefined) {
    if (!parentId) {
      return
    }
    const parentTag = await this.documentTagRepository.findOneById(parentId)
    if (parentTag?.name === PUBLIC_DOCUMENTS_TAG_NAME) {
      throw new BadRequestException(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot have children.`)
    }
  }

  async createDocumentTag({
    connectScope,
    fields,
  }: {
    connectScope: RequiredConnectScope
    fields: Pick<DocumentTag, "name"> & Partial<Pick<DocumentTag, "description" | "parentId">>
  }): Promise<DocumentTag> {
    if (this.isReservedPublicDocumentsName(fields.name)) {
      throw new BadRequestException(`Tag name "${PUBLIC_DOCUMENTS_TAG_NAME}" is reserved.`)
    }
    await this.assertParentIsNotPublicDocumentsTag(fields.parentId)
    return this.documentTagRepository.createOne(connectScope, {
      name: fields.name,
      description: fields.description ?? null,
      parentId: fields.parentId ?? null,
    })
  }

  createPublicDocumentsTag(connectScope: RequiredConnectScope): Promise<DocumentTag> {
    return this.documentTagRepository.createOne(connectScope, {
      name: PUBLIC_DOCUMENTS_TAG_NAME,
      description: null,
      parentId: null,
    })
  }

  async listDocumentTags(connectScope: RequiredConnectScope): Promise<DocumentTag[]> {
    const documentTags = await this.documentTagRepository.list(connectScope)
    return documentTags.sort((tag, otherTag) => tag.name.localeCompare(otherTag.name))
  }

  findDocumentTagById({
    connectScope,
    documentTagId,
  }: {
    connectScope: RequiredConnectScope
    documentTagId: string
  }): Promise<DocumentTag | null> {
    return this.documentTagRepository.findOne(connectScope, documentTagId)
  }

  async updateDocumentTag({
    connectScope,
    documentTagId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    documentTagId: string
    fieldsToUpdate: Partial<Pick<DocumentTag, "name" | "description" | "parentId">>
  }): Promise<DocumentTag> {
    const documentTag = await this.documentTagRepository.findOne(connectScope, documentTagId)

    if (!documentTag) {
      throw new NotFoundException(`DocumentTag with id ${documentTagId} not found`)
    }

    if (documentTag.name === PUBLIC_DOCUMENTS_TAG_NAME) {
      throw new BadRequestException(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be edited.`)
    }

    if (this.isReservedPublicDocumentsName(fieldsToUpdate.name)) {
      throw new BadRequestException(`Tag name "${PUBLIC_DOCUMENTS_TAG_NAME}" is reserved.`)
    }

    await this.assertParentIsNotPublicDocumentsTag(fieldsToUpdate.parentId)

    return this.documentTagRepository.updateOne(documentTag, fieldsToUpdate)
  }

  async deleteDocumentTag({
    connectScope,
    documentTagId,
  }: {
    connectScope: RequiredConnectScope
    documentTagId: string
  }): Promise<void> {
    const documentTag = await this.documentTagRepository.findOne(connectScope, documentTagId)

    if (!documentTag) {
      throw new NotFoundException(`DocumentTag with id ${documentTagId} not found`)
    }

    if (documentTag.name === PUBLIC_DOCUMENTS_TAG_NAME) {
      throw new BadRequestException(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be deleted.`)
    }

    await this.documentTagRepository.deleteOne(connectScope, documentTag.id)
  }
}

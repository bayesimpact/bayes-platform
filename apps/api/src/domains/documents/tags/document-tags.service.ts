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
    connectScope,
    currentTags,
    tagsToAdd = [],
    tagsToRemove = [],
  }: {
    connectScope: RequiredConnectScope
    currentTags: DocumentTag[]
  } & DocumentTagsUpdateFields): Promise<DocumentTag[]> {
    const uniqueTagIds = [...new Set(tagsToAdd)]
    const addedTags = await this.documentTagRepository.findByIds(connectScope, uniqueTagIds)
    if (addedTags.length !== uniqueTagIds.length) {
      const foundIds = new Set(addedTags.map((tag) => tag.id))
      const missingId = uniqueTagIds.find((tagId) => !foundIds.has(tagId))
      throw new NotFoundException(`DocumentTag with id ${missingId} not found`)
    }
    const tagsToRemoveSet = new Set(tagsToRemove)
    return [...currentTags.filter((tag) => !tagsToRemoveSet.has(tag.id)), ...addedTags]
  }

  // Match the reserved name case-insensitively so that variants like
  // "Public-Documents" cannot be created and silently bypass the reservation
  // (the retrieval query matches the exact lowercase name).
  private isReservedPublicDocumentsName(name: string | undefined): boolean {
    return name?.trim().toLowerCase() === PUBLIC_DOCUMENTS_TAG_NAME
  }

  private async assertParentIsInProject({
    connectScope,
    parentId,
    documentTagId,
  }: {
    connectScope: RequiredConnectScope
    parentId: string | null | undefined
    documentTagId?: string
  }) {
    if (!parentId) {
      return
    }

    if (documentTagId && parentId === documentTagId) {
      throw new BadRequestException("A tag cannot be its own parent.")
    }

    const parentTag = await this.documentTagRepository.findOne(connectScope, parentId)
    if (!parentTag) {
      throw new NotFoundException(`DocumentTag with id ${parentId} not found`)
    }

    if (parentTag.name === PUBLIC_DOCUMENTS_TAG_NAME) {
      throw new BadRequestException(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot have children.`)
    }

    if (documentTagId) {
      await this.assertParentIsNotDescendant(connectScope, parentTag, documentTagId)
    }
  }

  private async assertParentIsNotDescendant(
    connectScope: RequiredConnectScope,
    parentTag: DocumentTag,
    documentTagId: string,
  ) {
    const tags = await this.documentTagRepository.list(connectScope)
    const parentIdByTagId = new Map(tags.map((tag) => [tag.id, tag.parentId]))
    const seen = new Set<string>([parentTag.id])
    let currentParentId = parentTag.parentId

    while (currentParentId) {
      if (currentParentId === documentTagId) {
        throw new BadRequestException("A tag cannot have a descendant as its parent.")
      }
      if (seen.has(currentParentId)) {
        return
      }
      seen.add(currentParentId)
      currentParentId = parentIdByTagId.get(currentParentId) ?? null
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
    await this.assertParentIsInProject({ connectScope, parentId: fields.parentId })
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

    await this.assertParentIsInProject({
      connectScope,
      parentId: fieldsToUpdate.parentId,
      documentTagId,
    })

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

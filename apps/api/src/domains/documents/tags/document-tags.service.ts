import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { DocumentTag } from "./document-tag.entity"
import type { DocumentTagsUpdateFields } from "./document-tags.types"

@Injectable()
export class DocumentTagsService {
  constructor(
    @InjectRepository(DocumentTag)
    private readonly documentTagRepository: Repository<DocumentTag>,
  ) {
    this.documentTagConnectRepository = new ConnectRepository(
      documentTagRepository,
      "document-tags",
    )
  }

  private readonly documentTagConnectRepository: ConnectRepository<DocumentTag>

  async resolveTagChanges({
    currentTags,
    tagsToAdd = [],
    tagsToRemove = [],
  }: {
    currentTags: DocumentTag[]
  } & DocumentTagsUpdateFields): Promise<DocumentTag[]> {
    const addedTags =
      tagsToAdd.length > 0 ? await this.documentTagRepository.findBy({ id: In(tagsToAdd) }) : []
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
    const parentTag = await this.documentTagRepository.findOneBy({ id: parentId })
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
    return await this.documentTagConnectRepository.createAndSave(connectScope, {
      name: fields.name,
      description: fields.description ?? null,
      parentId: fields.parentId ?? null,
    })
  }

  async createPublicDocumentsTag(connectScope: RequiredConnectScope): Promise<DocumentTag> {
    return this.documentTagConnectRepository.createAndSave(connectScope, {
      name: PUBLIC_DOCUMENTS_TAG_NAME,
      description: null,
      parentId: null,
    })
  }

  async listDocumentTags(connectScope: RequiredConnectScope): Promise<DocumentTag[]> {
    return (await this.documentTagConnectRepository.getMany(connectScope))?.sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }

  async findDocumentTagById({
    connectScope,
    documentTagId,
  }: {
    connectScope: RequiredConnectScope
    documentTagId: string
  }): Promise<DocumentTag | null> {
    return this.documentTagConnectRepository.getOneById(connectScope, documentTagId)
  }

  async updateDocumentTag({
    connectScope,
    documentTagId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    documentTagId: string
    fieldsToUpdate: Pick<DocumentTag, "name" | "description" | "parentId">
  }): Promise<DocumentTag> {
    const documentTag = await this.documentTagConnectRepository.getOneById(
      connectScope,
      documentTagId,
    )

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

    Object.assign(documentTag, fieldsToUpdate)

    return await this.documentTagConnectRepository.saveOne(documentTag)
  }

  async deleteDocumentTag({
    connectScope,
    documentTagId,
  }: {
    connectScope: RequiredConnectScope
    documentTagId: string
  }): Promise<void> {
    const documentTag = await this.documentTagConnectRepository.getOneById(
      connectScope,
      documentTagId,
    )

    if (!documentTag) {
      throw new NotFoundException(`DocumentTag with id ${documentTagId} not found`)
    }

    if (documentTag.name === PUBLIC_DOCUMENTS_TAG_NAME) {
      throw new BadRequestException(`Tag "${PUBLIC_DOCUMENTS_TAG_NAME}" cannot be deleted.`)
    }

    // Manually delete relations in join tables before deleting the tag itself to avoid foreign key constraint errors
    // Document-DocumentTag relation
    await this.documentTagRepository.manager.query(
      "DELETE FROM document_document_tag WHERE document_tag_id = $1",
      [documentTag.id],
    )
    // Agent-DocumentTag relation
    await this.documentTagRepository.manager.query(
      "DELETE FROM agent_document_tag WHERE document_tag_id = $1",
      [documentTag.id],
    )

    await this.documentTagConnectRepository.deleteOneById({ connectScope, id: documentTag.id })
  }
}

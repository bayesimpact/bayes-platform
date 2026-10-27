import type { DocumentSourceStatus } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "../tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "../tags/document-tags.types"
import type { DocumentSource } from "./document-source.entity"
import type {
  CreateDocumentSourceFields,
  DocumentSourceAppRecord,
  UpdateDocumentSourceFields,
} from "./document-source.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentSourceRepository } from "./document-source.repository"

export type DocumentSourceSummary = {
  id: string
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  app: DocumentSourceAppRecord | null
  createdAt: Date
  updatedAt: Date
  documentCount: number
  indexedDocumentCount: number
  lastSyncedAt: Date | null
  status: DocumentSourceStatus
  tagIds: string[]
}

@Injectable()
export class DocumentSourcesService {
  constructor(
    private readonly documentSourceRepository: DocumentSourceRepository,
    private readonly documentTagsService: DocumentTagsService,
  ) {}

  async listSummaries(connectScope: RequiredConnectScope): Promise<DocumentSourceSummary[]> {
    const [documentSources, stats, tagLinks] = await Promise.all([
      this.documentSourceRepository.listWithApp(connectScope),
      this.documentSourceRepository.listStats(connectScope),
      this.documentSourceRepository.listTagLinks(connectScope),
    ])
    const statsBySourceId = new Map(stats.map((stat) => [stat.documentSourceId, stat]))
    const tagIdsBySourceId = new Map<string, string[]>()
    for (const tagLink of tagLinks) {
      const tagIds = tagIdsBySourceId.get(tagLink.documentSourceId) ?? []
      tagIds.push(tagLink.documentTagId)
      tagIdsBySourceId.set(tagLink.documentSourceId, tagIds)
    }

    return documentSources.map(({ documentSource, app }) => {
      const stat = statsBySourceId.get(documentSource.id)
      const failedDocumentCount = stat?.failedDocumentCount ?? 0
      return {
        id: documentSource.id,
        name: documentSource.name,
        type: documentSource.type,
        externalId: documentSource.externalId,
        baseUrl: documentSource.baseUrl,
        app,
        createdAt: documentSource.createdAt,
        updatedAt: documentSource.updatedAt,
        documentCount: stat?.documentCount ?? 0,
        indexedDocumentCount: stat?.indexedDocumentCount ?? 0,
        lastSyncedAt: stat?.lastSyncedAt ?? null,
        status: failedDocumentCount > 0 ? "error" : "ready",
        tagIds: tagIdsBySourceId.get(documentSource.id) ?? [],
      }
    })
  }

  getAll(
    connectScope: RequiredConnectScope,
    filters?: { externalId?: string },
  ): Promise<DocumentSource[]> {
    return this.documentSourceRepository.list(connectScope, filters)
  }

  getOne(connectScope: RequiredConnectScope, id: string): Promise<DocumentSource | null> {
    return this.documentSourceRepository.findOne(connectScope, id)
  }

  createOne(
    connectScope: RequiredConnectScope,
    fields: CreateDocumentSourceFields,
  ): Promise<DocumentSource> {
    return this.documentSourceRepository.createOne(connectScope, fields)
  }

  async updateOne(
    connectScope: RequiredConnectScope,
    id: string,
    fields: UpdateDocumentSourceFields,
  ): Promise<DocumentSource> {
    const documentSource = await this.documentSourceRepository.updateOne(connectScope, id, fields)
    if (!documentSource) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
    return documentSource
  }

  async updateTags(
    connectScope: RequiredConnectScope,
    id: string,
    { tagsToAdd, tagsToRemove }: DocumentTagsUpdateFields,
  ): Promise<DocumentSource> {
    const documentSource = await this.documentSourceRepository.findOne(connectScope, id, {
      withTags: true,
    })
    if (!documentSource) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
    const tags = await this.documentTagsService.resolveTagChanges({
      connectScope,
      currentTags: documentSource.tags ?? [],
      tagsToAdd,
      tagsToRemove,
    })
    return this.documentSourceRepository.saveTags(documentSource, uniqueById(tags))
  }

  async deleteOne(connectScope: RequiredConnectScope, id: string): Promise<void> {
    const deleted = await this.documentSourceRepository.deleteOne(connectScope, id)
    if (!deleted) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
  }

  async softDeleteOne(connectScope: RequiredConnectScope, id: string): Promise<void> {
    const deleted = await this.documentSourceRepository.softDeleteOne(connectScope, id)
    if (!deleted) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

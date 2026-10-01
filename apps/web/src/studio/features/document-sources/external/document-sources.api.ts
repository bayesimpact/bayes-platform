import { type DocumentSourceSummaryDto, DocumentSourcesRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { DocumentSource } from "../document-sources.models"
import type { IDocumentSourcesSpi } from "../document-sources.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentSourcesRoutes.getAll.response>(
      DocumentSourcesRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map((documentSource) => toDocumentSource(documentSource, projectId))
  },
  deleteOne: async ({ organizationId, projectId, documentSourceId }) => {
    const axios = getAxiosInstance()
    await axios.delete<typeof DocumentSourcesRoutes.deleteOne.response>(
      DocumentSourcesRoutes.deleteOne.getPath({ organizationId, projectId, documentSourceId }),
    )
  },
} satisfies IDocumentSourcesSpi

function toDocumentSource(dto: DocumentSourceSummaryDto, projectId: string): DocumentSource {
  return {
    id: dto.id,
    projectId,
    name: dto.name,
    type: dto.type,
    externalId: dto.externalId,
    baseUrl: dto.baseUrl,
    app: dto.app,
    documentCount: dto.documentCount,
    indexedDocumentCount: dto.indexedDocumentCount,
    lastSyncedAt: dto.lastSyncedAt,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

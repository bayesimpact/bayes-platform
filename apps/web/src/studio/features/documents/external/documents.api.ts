import {
  type DocumentDto,
  type DocumentSourceType,
  DocumentsRoutes,
  type PresignFileRequestItemDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { Document } from "../documents.models"
import type { IDocumentsSpi } from "../documents.spi"
import { streamDocumentCrawlProgress, streamDocumentEmbeddingStatus } from "./documents-streaming"

export default {
  getAll: async ({ organizationId, projectId, sourceType }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentsRoutes.getAll.response>(
      DocumentsRoutes.getAll.getPath({ organizationId, projectId, sourceType }),
    )
    return response.data.data.map(toDocument)
  },
  listMyExtractionDocuments: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentsRoutes.listMyExtractionDocuments.response>(
      DocumentsRoutes.listMyExtractionDocuments.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toDocument)
  },
  uploadOne: async ({ organizationId, projectId, file, sourceType, tagIds }) => {
    return presignUploadAndConfirm({ organizationId, projectId, file, sourceType, tagIds })
  },
  uploadMany: async ({ organizationId, projectId, files, sourceType, tagIds, onFileProcessed }) => {
    for (const file of files) {
      try {
        const document = await presignUploadAndConfirm({
          organizationId,
          projectId,
          file,
          sourceType,
          tagIds,
        })
        onFileProcessed({ file, status: "success", document })
      } catch (error) {
        const errorMessage = error instanceof Error ? error : new Error(String(error))
        onFileProcessed({ file, status: "error", error: errorMessage })
      }
    }
  },
  updateOne: async ({ organizationId, projectId, documentId, payload }) => {
    const axios = getAxiosInstance()
    await axios.patch<typeof DocumentsRoutes.updateOne>(
      DocumentsRoutes.updateOne.getPath({ organizationId, projectId, documentId }),
      { payload } satisfies typeof DocumentsRoutes.updateOne.request,
    )
  },
  reprocessOne: async ({ organizationId, projectId, documentId }) => {
    const axios = getAxiosInstance()
    await axios.post<typeof DocumentsRoutes.reprocessOne.response>(
      DocumentsRoutes.reprocessOne.getPath({ organizationId, projectId, documentId }),
      {},
    )
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete<typeof DocumentsRoutes.deleteOne>(DocumentsRoutes.deleteOne.getPath(params))
  },
  getTemporaryUrl: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentsRoutes.getTemporaryUrl.response>(
      DocumentsRoutes.getTemporaryUrl.getPath(params),
    )
    return response.data.data
  },
  getIsPublic: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof DocumentsRoutes.getIsPublic.response>(
      DocumentsRoutes.getIsPublic.getPath(params),
    )
    return response.data.data
  },
  streamEmbeddingStatus: async ({ organizationId, projectId, signal, onStatusChanged }) => {
    await streamDocumentEmbeddingStatus({
      organizationId,
      projectId,
      signal,
      onStatusChanged,
    })
  },
  streamCrawlProgress: async ({ organizationId, projectId, signal, onProgressChanged }) => {
    await streamDocumentCrawlProgress({
      organizationId,
      projectId,
      signal,
      onProgressChanged,
    })
  },
  crawlUrl: async ({ organizationId, projectId, url, name }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof DocumentsRoutes.crawlUrl.response>(
      DocumentsRoutes.crawlUrl.getPath({ organizationId, projectId }),
      { payload: { url, name } } satisfies typeof DocumentsRoutes.crawlUrl.request,
    )
    return response.data.data
  },
  reCrawlUrl: async ({ organizationId, projectId, documentId }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof DocumentsRoutes.reCrawlUrl.response>(
      DocumentsRoutes.reCrawlUrl.getPath({ organizationId, projectId, documentId }),
    )
    return response.data.data
  },
} satisfies IDocumentsSpi

// Presign → upload directly to GCS → confirm. Shared by uploadOne and uploadMany.
async function presignUploadAndConfirm({
  organizationId,
  projectId,
  file,
  sourceType,
  tagIds,
}: {
  organizationId: string
  projectId: string
  file: File
  sourceType: DocumentSourceType
  tagIds?: string[]
}): Promise<Document> {
  const axios = getAxiosInstance()

  // 1. Presign a single file — creates a pending document entity
  const presignResponse = await axios.post<typeof DocumentsRoutes.presignMany.response>(
    DocumentsRoutes.presignMany.getPath({ organizationId, projectId, sourceType }),
    {
      payload: {
        files: [
          {
            fileName: file.name,
            mimeType: file.type as PresignFileRequestItemDto["mimeType"],
            size: file.size,
          },
        ],
      },
    } satisfies typeof DocumentsRoutes.presignMany.request,
  )
  const [presigned] = presignResponse.data.data

  if (!presigned) {
    throw new Error(`Presign response is missing data`)
  }

  // 2. Upload directly to GCS
  await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  })

  // 3. Confirm — backend marks as uploaded and enqueues embeddings
  const confirmResponse = await axios.post<typeof DocumentsRoutes.confirmMany.response>(
    DocumentsRoutes.confirmMany.getPath({ organizationId, projectId }),
    {
      payload: {
        documentIds: [presigned.documentId],
        ...(tagIds !== undefined && tagIds.length > 0 ? { tagIds } : {}),
      },
    } satisfies typeof DocumentsRoutes.confirmMany.request,
  )

  const [document] = confirmResponse.data.data.map(toDocument)

  if (!document) {
    throw new Error(`Confirm response is missing data`)
  }

  return document
}

function toDocument(dto: DocumentDto): Document {
  return {
    content: dto.content,
    pages: dto.pages,
    createdAt: dto.createdAt,
    deletedAt: dto.deletedAt,
    fileName: dto.fileName,
    id: dto.id,
    language: dto.language,
    mimeType: dto.mimeType,
    projectId: dto.projectId,
    size: dto.size,
    storageRelativePath: dto.storageRelativePath,
    sourceType: dto.sourceType,
    sourceUrl: dto.sourceUrl,
    embeddingStatus: dto.embeddingStatus,
    embeddingError: dto.embeddingError ?? null,
    title: dto.title,
    updatedAt: dto.updatedAt,
    tagIds: dto.tagIds,
  }
}

import type { ProjectEmbeddingModelDto } from "@caseai-connect/api-contracts"

export type ProjectEmbeddingModel = ProjectEmbeddingModelDto

// Web-local event shape used after mapping from API DTO stream events.
export type ProjectEmbeddingModelProgressEvent = {
  projectEmbeddingModelId: string
  modelName: ProjectEmbeddingModel["modelName"]
  status: ProjectEmbeddingModel["status"]
  totalChunks: number
  processedChunks: number
  error: string | null
  updatedAt: number
}

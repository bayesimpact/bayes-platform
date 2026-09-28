import type { ProjectEmbeddingModelDto } from "@caseai-connect/api-contracts"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"

export function toProjectEmbeddingModelDto(
  projectEmbeddingModel: ProjectEmbeddingModel,
): ProjectEmbeddingModelDto {
  return {
    id: projectEmbeddingModel.id,
    projectId: projectEmbeddingModel.projectId,
    modelName: projectEmbeddingModel.modelName,
    status: projectEmbeddingModel.status,
    totalChunks: projectEmbeddingModel.totalChunks,
    processedChunks: projectEmbeddingModel.processedChunks,
    error: projectEmbeddingModel.error ?? null,
    createdAt: projectEmbeddingModel.createdAt.getTime(),
    updatedAt: projectEmbeddingModel.updatedAt.getTime(),
  }
}

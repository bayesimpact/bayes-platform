import type { EmbeddingModel } from "@caseai-connect/api-contracts"

export type ReembedProjectChunksJobPayload = {
  projectEmbeddingModelId: string
  organizationId: string
  projectId: string
  modelName: EmbeddingModel
}

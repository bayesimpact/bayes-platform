import type { EmbeddingModel } from "@bayes-platform/api-contracts"

export type ReembedProjectChunksJobPayload = {
  projectEmbeddingModelId: string
  organizationId: string
  projectId: string
  modelName: EmbeddingModel
}

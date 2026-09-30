import type { EmbeddingModel } from "@caseai-connect/api-contracts"

export type EmbedQueryJobPayload = {
  modelName: EmbeddingModel
  text: string
}

export type EmbedQueryJobResult = {
  embedding: number[]
}

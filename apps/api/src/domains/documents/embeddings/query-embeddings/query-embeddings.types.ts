import type { EmbeddingModel } from "@caseai-connect/api-contracts"
import type { SparseWeights } from "@/external/local-embeddings/local-embedding-bridge.service"

export type EmbedQueryJobPayload = {
  modelName: EmbeddingModel
  text: string
}

export type EmbedQueryJobResult = {
  embedding: number[]
  /** Lexical weights of the query, for models with a sparse head. */
  sparseEmbedding: SparseWeights | null
}

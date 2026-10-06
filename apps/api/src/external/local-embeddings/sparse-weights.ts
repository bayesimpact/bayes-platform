import { getEmbeddingModelMetadata } from "@caseai-connect/api-contracts"
import { SparseVector } from "pgvector"
import type { SparseWeights } from "./local-embedding-bridge.service"

/**
 * pgvector `sparsevec` literal for a model's lexical weights, or null when the model has none.
 * The vocabulary size of the catalog is the vector's dimension.
 */
export function toSparseVectorSql(
  modelName: string,
  weights: SparseWeights | null | undefined,
): string | null {
  if (!weights) return null
  const dimensions = getEmbeddingModelMetadata(modelName)?.sparse?.dimensions
  if (!dimensions) {
    throw new Error(`Embedding model ${modelName} has sparse weights but no sparse dimensions`)
  }
  return new SparseVector(weights, dimensions).toPostgres()
}

/** Whether chunks embedded with this model must carry lexical weights. */
export function hasSparseWeights(modelName: string): boolean {
  return getEmbeddingModelMetadata(modelName)?.sparse !== undefined
}

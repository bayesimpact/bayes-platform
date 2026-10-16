export type EmbedderInputType = "query" | "document"

/** Lexical weights of one text: vocabulary token id (as a string) to weight. */
export type SparseWeights = Record<string, number>

/** One dense vector per text, plus lexical weights when the model has a sparse head. */
export type Embeddings = {
  dense: number[][]
  sparse: SparseWeights[] | null
}

export type QueryEmbedding = {
  embedding: number[]
  sparseEmbedding: SparseWeights | null
}

/**
 * Body of `POST {url}/v1/embed`, the contract every HTTP embedder serves (see apps/embedder).
 * `model` lets one server host several models.
 */
export type HttpEmbedRequest = {
  model: string
  texts: string[]
  input_type: EmbedderInputType
}

export type HttpEmbedResponse = {
  dimensions: number
  dense: number[][]
  sparse: SparseWeights[] | null
}

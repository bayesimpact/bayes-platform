/**
 * Body of `POST {url}/v1/embeddings`, the OpenAI embeddings API that every self-hosted embedder
 * serves (vLLM, text-embeddings-inference, Ollama, Infinity...).
 */
export type OpenAiEmbeddingsRequest = {
  model: string
  input: string[]
  encoding_format: "float"
}

export type OpenAiEmbeddingsResponse = {
  data: { index: number; embedding: number[] }[]
}

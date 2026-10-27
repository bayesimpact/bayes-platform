import { EmbeddingModel, isLocalEmbeddingModel } from "@caseai-connect/api-contracts"
import { readPositiveIntEnv } from "@/config/positive-int-env"

/**
 * Environment prefix of each self-hosted model: `EMBEDDER_<KEY>_URL` (base URL of an OpenAI
 * embeddings server, without /v1), `EMBEDDER_<KEY>_API_KEY` and `EMBEDDER_<KEY>_MODEL` (the name
 * the server knows the model by, when it is not the catalog id, e.g. `bge-m3` on Ollama). A model
 * of the catalog with no URL in the environment is simply not offered by the deployment.
 */
const HTTP_EMBEDDER_ENV_KEYS: Partial<Record<EmbeddingModel, string>> = {
  [EmbeddingModel.BgeM3]: "BGE_M3",
}

const DEFAULT_EMBEDDER_BATCH_SIZE = 32
const DEFAULT_EMBEDDER_REQUEST_TIMEOUT_MS = 120_000
const DEFAULT_EMBEDDER_QUERY_TIMEOUT_MS = 3_000

export type HttpEmbedderConfig = {
  url: string
  apiKey: string | undefined
  servedModelName: string
}

export function resolveHttpEmbedderConfig(modelName: string): HttpEmbedderConfig | undefined {
  if (!isLocalEmbeddingModel(modelName)) return undefined
  const envKey = HTTP_EMBEDDER_ENV_KEYS[modelName]
  if (!envKey) return undefined
  const url = process.env[`EMBEDDER_${envKey}_URL`]?.trim()
  if (!url) return undefined
  return {
    url: url.replace(/\/+$/, ""),
    apiKey: process.env[`EMBEDDER_${envKey}_API_KEY`]?.trim() || undefined,
    servedModelName: process.env[`EMBEDDER_${envKey}_MODEL`]?.trim() || modelName,
  }
}

/** Name of the variable that makes a model available, for error messages. */
export function getHttpEmbedderUrlVariable(modelName: string): string {
  const envKey = isLocalEmbeddingModel(modelName) ? HTTP_EMBEDDER_ENV_KEYS[modelName] : undefined
  return envKey ? `EMBEDDER_${envKey}_URL` : "an EMBEDDER_<MODEL>_URL variable"
}

/** Chunks sent to a self-hosted embedder per request. */
export function getEmbedderBatchSize(): number {
  return readPositiveIntEnv("EMBEDDER_BATCH_SIZE", { defaultValue: DEFAULT_EMBEDDER_BATCH_SIZE })
}

/** How long one batch of chunks may take before the request fails. */
export function getEmbedderRequestTimeoutMs(): number {
  return readPositiveIntEnv("EMBEDDER_REQUEST_TIMEOUT_MS", {
    defaultValue: DEFAULT_EMBEDDER_REQUEST_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}

/** How long a chat turn waits for the query vector before falling back to the default model. */
export function getEmbedderQueryTimeoutMs(): number {
  return readPositiveIntEnv("EMBEDDER_QUERY_TIMEOUT_MS", {
    defaultValue: DEFAULT_EMBEDDER_QUERY_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}

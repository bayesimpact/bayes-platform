import { z } from "zod"
import type { TimeType } from "../generic"

/**
 * Embedding models the platform can use for document retrieval.
 *
 * `gemini-embedding-001` is the historical default, computed for every project through Vertex.
 * The local models are served by the GPU workers themselves (sentence-transformers) and only
 * exist for projects with the `local-embeddings` feature flag. The enum value is the exact
 * `model_name` persisted on `document_chunk_embedding`.
 */
export enum EmbeddingModel {
  GeminiEmbedding001 = "gemini-embedding-001",
  BgeM3 = "BAAI/bge-m3",
  EmbeddingGemma300m = "google/embeddinggemma-300m",
}

export enum EmbeddingProvider {
  Vertex = "VERTEX",
  Local = "LOCAL",
}

export type EmbeddingModelMetadata = {
  provider: EmbeddingProvider
  /** Vector size the model produces. Informational: the storage column is untyped. */
  dimensions: number
  label: string
}

/**
 * Exhaustive on purpose: adding a value to `EmbeddingModel` fails to compile until it has an
 * entry here, so a model can never ship without its provider and dimensions.
 */
export const EmbeddingModelCatalog: Record<EmbeddingModel, EmbeddingModelMetadata> = {
  [EmbeddingModel.GeminiEmbedding001]: {
    provider: EmbeddingProvider.Vertex,
    dimensions: 3072,
    label: "Gemini Embedding 001 (Vertex)",
  },
  [EmbeddingModel.BgeM3]: {
    provider: EmbeddingProvider.Local,
    dimensions: 1024,
    label: "BGE-M3 (local)",
  },
  [EmbeddingModel.EmbeddingGemma300m]: {
    provider: EmbeddingProvider.Local,
    dimensions: 768,
    label: "EmbeddingGemma 300M (local)",
  },
}

/** Model every project has and every agent retrieves with unless it picks another one. */
export const DEFAULT_EMBEDDING_MODEL = EmbeddingModel.GeminiEmbedding001

/** Same catalog, read as a plain string lookup so a stale stored value is a miss, not a crash. */
const embeddingModelMetadata: Partial<Record<string, EmbeddingModelMetadata>> =
  EmbeddingModelCatalog

export function getEmbeddingModelMetadata(model: string): EmbeddingModelMetadata | undefined {
  return embeddingModelMetadata[model]
}

export function isLocalEmbeddingModel(model: string): model is EmbeddingModel {
  return embeddingModelMetadata[model]?.provider === EmbeddingProvider.Local
}

export const LOCAL_EMBEDDING_MODELS: EmbeddingModel[] = (
  Object.keys(EmbeddingModelCatalog) as EmbeddingModel[]
).filter((model) => isLocalEmbeddingModel(model))

/**
 * Lifecycle of a local model on a project.
 * - pending: enabled, the re-embedding job is queued
 * - processing: the job embeds the existing chunks, `processedChunks` grows
 * - completed: every chunk has a vector, agents can retrieve with the model
 * - failed: the job stopped, `error` says why, enabling again retries
 */
export type ProjectEmbeddingModelStatus = "pending" | "processing" | "completed" | "failed"

export type ProjectEmbeddingModelDto = {
  id: string
  projectId: string
  modelName: EmbeddingModel
  status: ProjectEmbeddingModelStatus
  totalChunks: number
  processedChunks: number
  error: string | null
  createdAt: TimeType
  updatedAt: TimeType
}

export const enableProjectEmbeddingModelSchema = z.object({
  modelName: z.enum(EmbeddingModel),
})
export type EnableProjectEmbeddingModelRequestDto = z.infer<
  typeof enableProjectEmbeddingModelSchema
>

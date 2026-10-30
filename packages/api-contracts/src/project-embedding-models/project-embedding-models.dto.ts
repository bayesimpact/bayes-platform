import { z } from "zod"
import type { TimeType } from "../generic"

/**
 * Embedding models the platform can use for document retrieval. A project embeds its documents
 * with the models it enabled, and each agent searches with one of them. The enum value is the
 * exact `model_name` persisted on `document_chunk_embedding`.
 */
export enum EmbeddingModel {
  GeminiEmbedding001 = "gemini-embedding-001",
  BgeM3 = "BAAI/bge-m3",
}

/** How the platform reaches a model: the only place where models differ. */
export enum EmbeddingProvider {
  Vertex = "VERTEX",
  /** A server speaking the OpenAI embeddings API (vLLM, text-embeddings-inference...). */
  OpenAiCompatible = "OPENAI_COMPATIBLE",
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
    label: "Gemini Embedding 001",
  },
  [EmbeddingModel.BgeM3]: {
    provider: EmbeddingProvider.OpenAiCompatible,
    dimensions: 1024,
    label: "BGE-M3",
  },
}

export const EMBEDDING_MODELS = Object.values(EmbeddingModel)

/** Same catalog, read as a plain string lookup so a stale stored value is a miss, not a crash. */
const embeddingModelMetadata: Partial<Record<string, EmbeddingModelMetadata>> =
  EmbeddingModelCatalog

export function getEmbeddingModelMetadata(model: string): EmbeddingModelMetadata | undefined {
  return embeddingModelMetadata[model]
}

/**
 * Lifecycle of a model on a project.
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
  /** The model new agents of the project search with. One per project. */
  isDefault: boolean
  createdAt: TimeType
  updatedAt: TimeType
}

export const enableProjectEmbeddingModelSchema = z.object({
  modelName: z.enum(EmbeddingModel),
})
export type EnableProjectEmbeddingModelRequestDto = z.infer<
  typeof enableProjectEmbeddingModelSchema
>

/** Makes a completed model the project's default: the only change a model takes. */
export const updateProjectEmbeddingModelSchema = z.object({
  isDefault: z.literal(true),
})
export type UpdateProjectEmbeddingModelRequestDto = z.infer<
  typeof updateProjectEmbeddingModelSchema
>

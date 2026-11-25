import { InternalServerErrorException } from "@nestjs/common"
import { readPositiveIntEnv } from "@/config/positive-int-env"

const toNonEmptyValue = (value: string | undefined): string | undefined => {
  const trimmedValue = value?.trim()
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined
}

const normalizeVertexLocation = (value: string): string => {
  const trimmedValue = value.trim()
  // Cloud runtimes sometimes expose zones (for example "us-central1-a"), but Vertex expects regions.
  if (/^[a-z]+-[a-z0-9]+[0-9]-[a-z]$/.test(trimmedValue)) {
    return trimmedValue.slice(0, -2)
  }
  return trimmedValue
}

const DEFAULT_MAX_VERTEX_EMBEDDING_BATCH_SIZE = 250
const MIN_VERTEX_EMBEDDING_BATCH_SIZE = 1
const MAX_ALLOWED_VERTEX_EMBEDDING_BATCH_SIZE = 250

export const resolveVertexConfig = (): { project: string; location: string } => {
  const project = toNonEmptyValue(process.env.GOOGLE_VERTEX_PROJECT)

  const rawLocation = toNonEmptyValue(process.env.GOOGLE_VERTEX_LOCATION)

  if (!project) {
    throw new InternalServerErrorException(
      "Missing Vertex project configuration. Set GOOGLE_VERTEX_PROJECT.",
    )
  }
  if (!rawLocation) {
    throw new InternalServerErrorException(
      "Missing Vertex location configuration. Set GOOGLE_VERTEX_LOCATION.",
    )
  }
  const location = normalizeVertexLocation(rawLocation)

  return { project, location }
}

export const resolveEmbeddingModelNames = (): string[] => {
  const configuredModelNames = toNonEmptyValue(process.env.DOCUMENT_EMBEDDING_MODELS)
  if (!configuredModelNames) {
    throw new InternalServerErrorException(
      "Missing embedding model configuration. Set DOCUMENT_EMBEDDING_MODELS.",
    )
  }

  const modelNames = configuredModelNames
    .split(",")
    .map((modelName) => modelName.trim())
    .filter((modelName) => modelName.length > 0)

  if (modelNames.length === 0) {
    throw new InternalServerErrorException(
      "Missing embedding model configuration. Set DOCUMENT_EMBEDDING_MODELS with at least one model.",
    )
  }

  return [...new Set(modelNames)]
}

export const resolveMaxVertexEmbeddingBatchSize = (): number => {
  const configuredBatchSize = toNonEmptyValue(process.env.MAX_VERTEX_EMBEDDING_BATCH_SIZE)
  if (!configuredBatchSize) {
    return DEFAULT_MAX_VERTEX_EMBEDDING_BATCH_SIZE
  }

  const parsedBatchSize = Number.parseInt(configuredBatchSize, 10)
  if (
    Number.isNaN(parsedBatchSize) ||
    parsedBatchSize < MIN_VERTEX_EMBEDDING_BATCH_SIZE ||
    parsedBatchSize > MAX_ALLOWED_VERTEX_EMBEDDING_BATCH_SIZE
  ) {
    throw new InternalServerErrorException(
      `Invalid MAX_VERTEX_EMBEDDING_BATCH_SIZE: ${configuredBatchSize}. Expected an integer between ${MIN_VERTEX_EMBEDDING_BATCH_SIZE} and ${MAX_ALLOWED_VERTEX_EMBEDDING_BATCH_SIZE}.`,
    )
  }

  return parsedBatchSize
}

const DEFAULT_MAX_RETRIEVED_CHUNK_CHARACTERS = 8000

/**
 * The most text one knowledge base hit gives the model. A section above it is replaced by the
 * matching passage and its neighbours, so one long section cannot fill the lookup.
 */
export const resolveMaxRetrievedChunkCharacters = (): number =>
  readPositiveIntEnv("DOCUMENT_RETRIEVAL_MAX_CHUNK_CHARS", {
    defaultValue: DEFAULT_MAX_RETRIEVED_CHUNK_CHARACTERS,
    unitWord: "characters",
  })

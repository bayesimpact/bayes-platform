import type { ReembedProjectChunksJobPayload } from "./project-embedding-reembed.types"

export const PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE = Symbol(
  "PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE",
)

export interface ProjectEmbeddingReembedBatchService {
  enqueueReembedProjectChunks(payload: ReembedProjectChunksJobPayload): Promise<void>
  /** Whether a job for this row is still waiting, delayed for a retry, or running. */
  isReembedJobQueued(projectEmbeddingModelId: string): Promise<boolean>
}

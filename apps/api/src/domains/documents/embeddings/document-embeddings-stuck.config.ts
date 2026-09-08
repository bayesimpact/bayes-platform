import { readPositiveIntEnv } from "@/config/positive-int-env"

/** Max age for `queued` / `processing` before the sweep marks the document as timed out. */
export function getDocumentEmbeddingStuckThresholdSeconds(): number {
  return readPositiveIntEnv("DOCUMENT_EMBEDDING_STUCK_THRESHOLD_SECONDS", { unitWord: "seconds" })
}

/** How often the BullMQ scheduler enqueues a stuck-embedding sweep job (Bull `every` uses ms internally). */
export function getDocumentEmbeddingStuckSweepIntervalSeconds(): number {
  return readPositiveIntEnv("DOCUMENT_EMBEDDING_STUCK_SWEEP_INTERVAL_SECONDS", {
    unitWord: "seconds",
  })
}

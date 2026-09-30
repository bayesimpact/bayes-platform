import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"
import { readPositiveIntEnv } from "@/config/positive-int-env"

const DOCUMENT_EMBEDDER_RELATIVE_FROM_API = "bin/document_embedder"
const DOCUMENT_EMBEDDER_RELATIVE_FROM_REPO_ROOT = "apps/api/bin/document_embedder"

const DEFAULT_LOCAL_EMBEDDING_REQUEST_TIMEOUT_MS = 120_000
const DEFAULT_LOCAL_EMBEDDING_BATCH_SIZE = 32
const DEFAULT_LOCAL_EMBEDDINGS_VERSION_TIMEOUT_MS = 30_000

const runCommand = promisify(execFile)

/**
 * Whether this process may embed with the local HuggingFace models. Off by default: only the
 * GPU workers image ships the Python runtime, and a local checkout opts in once the repo venv
 * has sentence-transformers installed.
 */
export function isLocalEmbeddingsEnabled(): boolean {
  const value = process.env.LOCAL_EMBEDDINGS_ENABLED
  if (!value) {
    return false
  }
  return value.toLowerCase() === "true"
}

/** Same cwd probing as the Docling chunker: the API runs from the repo root or from apps/api. */
export function getDocumentEmbedderCommand(): string {
  const envOverride = process.env.DOCUMENT_EMBEDDER_COMMAND
  if (envOverride) {
    return envOverride
  }

  const cwd = process.cwd()
  const candidates = [
    join(cwd, DOCUMENT_EMBEDDER_RELATIVE_FROM_API),
    join(cwd, DOCUMENT_EMBEDDER_RELATIVE_FROM_REPO_ROOT),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return candidates[1] as string
}

/** How long one embed request (a batch of chunks or a query) may take before it fails. */
export function getLocalEmbeddingRequestTimeoutMs(): number {
  return readPositiveIntEnv("LOCAL_EMBEDDING_REQUEST_TIMEOUT_MS", {
    defaultValue: DEFAULT_LOCAL_EMBEDDING_REQUEST_TIMEOUT_MS,
    unitWord: "milliseconds",
  })
}

/** Chunks sent to the model per request. Bounded by GPU memory rather than an API quota. */
export function getLocalEmbeddingBatchSize(): number {
  return readPositiveIntEnv("LOCAL_EMBEDDING_BATCH_SIZE", {
    defaultValue: DEFAULT_LOCAL_EMBEDDING_BATCH_SIZE,
  })
}

/** Boot check: the embedder script answers `--version` only when its Python deps import. */
export async function getLocalEmbeddingsVersion({
  timeoutMs = DEFAULT_LOCAL_EMBEDDINGS_VERSION_TIMEOUT_MS,
}: {
  timeoutMs?: number
} = {}): Promise<string> {
  const { stdout } = await runCommand(getDocumentEmbedderCommand(), ["--version"], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  })
  return stdout.trim()
}

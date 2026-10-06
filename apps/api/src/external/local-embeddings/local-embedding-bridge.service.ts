import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common"
import {
  getDocumentEmbedderCommand,
  getLocalEmbeddingRequestTimeoutMs,
  isLocalEmbeddingsEnabled,
} from "./local-embeddings.cli"

export type LocalEmbeddingInputType = "query" | "document"

/** Lexical weights of one text: vocabulary token id (as a string) to weight. */
export type SparseWeights = Record<string, number>

/** One dense vector per text, plus lexical weights when the model has a sparse head. */
export type LocalEmbeddings = {
  dense: number[][]
  sparse: SparseWeights[] | null
}

export type LocalEmbedRequest = {
  modelName: string
  texts: string[]
  inputType: LocalEmbeddingInputType
}

type EmbedderResponse = {
  id: string
  model?: string
  dimensions?: number
  embeddings?: number[][]
  sparse_embeddings?: SparseWeights[]
  error?: string
}

type PendingRequest = {
  resolve: (embeddings: LocalEmbeddings) => void
  reject: (error: Error) => void
  timeoutHandle: NodeJS.Timeout
}

/** Thrown to in-flight requests when the worker process stops: the job is retried, not failed. */
export class LocalEmbedderShuttingDownError extends Error {
  constructor() {
    super("Local embedding interrupted: the worker is shutting down")
    this.name = "LocalEmbedderShuttingDownError"
  }
}

export const LOCAL_EMBEDDINGS_DISABLED_ERROR_MESSAGE =
  "Local embeddings are not enabled on this worker (set LOCAL_EMBEDDINGS_ENABLED=true on a worker with the Python embedder installed)."

/**
 * Talks to one long-lived `document_embedder --serve` subprocess over JSON lines: one request
 * object in on stdin, one response object out on stdout. The process loads each model once and
 * keeps it in memory, which is what makes per-batch and per-query calls cheap. It is started on
 * the first request and restarted on the next one if it dies.
 */
@Injectable()
export class LocalEmbeddingBridgeService implements OnModuleDestroy {
  private readonly logger = new Logger(LocalEmbeddingBridgeService.name)
  private child: ChildProcessWithoutNullStreams | null = null
  private stdoutBuffer = ""
  private readonly pending = new Map<string, PendingRequest>()

  isEnabled(): boolean {
    return isLocalEmbeddingsEnabled()
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error(LOCAL_EMBEDDINGS_DISABLED_ERROR_MESSAGE)
    }
  }

  async embed({ modelName, texts, inputType }: LocalEmbedRequest): Promise<LocalEmbeddings> {
    this.assertEnabled()
    if (texts.length === 0) return { dense: [], sparse: null }

    const child = this.getOrSpawnChild()
    const id = randomUUID()
    const request = JSON.stringify({ id, model: modelName, texts, input_type: inputType })
    const timeoutMs = getLocalEmbeddingRequestTimeoutMs()

    return new Promise<LocalEmbeddings>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id)
        reject(
          new Error(
            `Local embedding request timed out after ${timeoutMs}ms (model ${modelName}, ${texts.length} texts)`,
          ),
        )
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timeoutHandle })
      child.stdin.write(`${request}\n`, (writeError) => {
        if (writeError) {
          this.settle(id, { id, error: `Could not write to the embedder: ${writeError.message}` })
        }
      })
    })
  }

  onModuleDestroy(): void {
    this.stopChild()
  }

  private getOrSpawnChild(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child

    const command = getDocumentEmbedderCommand()
    this.logger.log(`Starting local embedder: ${command} --serve`)
    const child = spawn(command, ["--serve"], { stdio: ["pipe", "pipe", "pipe"] })
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (data: string) => this.onStdout(data))
    child.stderr.on("data", (data: string) => {
      const line = data.trim()
      if (line) this.logger.debug(`[embedder] ${line}`)
    })
    child.on("error", (error) => {
      this.logger.error(`Local embedder failed to start: ${error.message}`)
      this.onChildGone(`the embedder could not be started (${error.message})`)
    })
    child.on("exit", (code, signal) => {
      this.logger.warn(`Local embedder exited (code ${code}, signal ${signal})`)
      this.onChildGone(`the embedder exited (code ${code}, signal ${signal})`)
    })
    this.child = child
    this.stdoutBuffer = ""
    return child
  }

  private onStdout(data: string): void {
    this.stdoutBuffer += data
    let newlineIndex = this.stdoutBuffer.indexOf("\n")
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim()
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)
      if (line) this.onResponseLine(line)
      newlineIndex = this.stdoutBuffer.indexOf("\n")
    }
  }

  private onResponseLine(line: string): void {
    let response: EmbedderResponse
    try {
      response = JSON.parse(line) as EmbedderResponse
    } catch {
      this.logger.warn(`Ignoring non-JSON line from the embedder: ${line.slice(0, 200)}`)
      return
    }
    if (!response.id) {
      this.logger.warn(`Ignoring embedder response without id: ${line.slice(0, 200)}`)
      return
    }
    this.settle(response.id, response)
  }

  private settle(id: string, response: EmbedderResponse): void {
    const pendingRequest = this.pending.get(id)
    if (!pendingRequest) return
    this.pending.delete(id)
    clearTimeout(pendingRequest.timeoutHandle)
    if (response.error !== undefined || !Array.isArray(response.embeddings)) {
      pendingRequest.reject(
        new Error(`Local embedding failed: ${response.error ?? "no embeddings in the response"}`),
      )
      return
    }
    pendingRequest.resolve({
      dense: response.embeddings,
      sparse: response.sparse_embeddings ?? null,
    })
  }

  private onChildGone(reason: string, error?: Error): void {
    this.child = null
    this.stdoutBuffer = ""
    for (const [id, pendingRequest] of this.pending) {
      clearTimeout(pendingRequest.timeoutHandle)
      pendingRequest.reject(error ?? new Error(`Local embedding failed: ${reason}`))
      this.pending.delete(id)
    }
  }

  private stopChild(): void {
    const child = this.child
    if (!child) return
    this.child = null
    child.stdin.end()
    child.kill()
    this.onChildGone("the worker is shutting down", new LocalEmbedderShuttingDownError())
  }
}

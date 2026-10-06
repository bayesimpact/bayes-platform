import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { LocalEmbeddingBridgeService } from "@/external/local-embeddings/local-embedding-bridge.service"
import { QUERY_EMBEDDINGS_QUEUE_NAME } from "./query-embeddings.constants"
import type { EmbedQueryJobPayload, EmbedQueryJobResult } from "./query-embeddings.types"

/**
 * Embeds one retrieval query with a local model and hands the vector back as the job result.
 * The API has no Python runtime, so this is how a chat turn reaches the GPU workers.
 */
@Processor(QUERY_EMBEDDINGS_QUEUE_NAME, {
  // Queries are short and latency-sensitive: keep answering while a re-embedding job runs.
  concurrency: 4,
})
export class QueryEmbeddingsWorker extends WorkerHost {
  private readonly logger = new Logger(QueryEmbeddingsWorker.name)

  constructor(private readonly localEmbeddingBridge: LocalEmbeddingBridgeService) {
    super()
  }

  async process(job: Job<EmbedQueryJobPayload>): Promise<EmbedQueryJobResult> {
    const { modelName, text } = job.data
    const { dense, sparse } = await this.localEmbeddingBridge.embed({
      modelName,
      texts: [text],
      inputType: "query",
    })
    const [embedding] = dense
    if (!embedding) {
      throw new Error(`Local embedder returned no vector for model ${modelName}`)
    }
    this.logger.debug(`Embedded query with ${modelName} (job ${job.id})`)
    return { embedding, sparseEmbedding: sparse?.[0] ?? null }
  }
}

import { createVertex } from "@ai-sdk/google-vertex"
import { isLocalEmbeddingModel } from "@caseai-connect/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import { embed, embedMany } from "ai"
import {
  resolveMaxVertexEmbeddingBatchSize,
  resolveVertexConfig,
} from "../document-embeddings.config"
import {
  getEmbedderBatchSize,
  getEmbedderQueryTimeoutMs,
  getEmbedderRequestTimeoutMs,
  getHttpEmbedderUrlVariable,
  type HttpEmbedderConfig,
  resolveHttpEmbedderConfig,
} from "./embedders.config"
import type {
  EmbedderInputType,
  Embeddings,
  HttpEmbedRequest,
  HttpEmbedResponse,
  QueryEmbedding,
  SparseWeights,
} from "./embedders.types"

/**
 * The one way the platform turns text into vectors, for chunks and queries alike. Self-hosted
 * models of the catalog are reached over HTTP (`POST {url}/v1/embed`); every other model name is
 * a Vertex model called through the AI SDK.
 */
@Injectable()
export class EmbedderService {
  private readonly logger = new Logger(EmbedderService.name)

  /** Vertex models are always there; a self-hosted model needs its URL in the environment. */
  isAvailable(modelName: string): boolean {
    return !isLocalEmbeddingModel(modelName) || resolveHttpEmbedderConfig(modelName) !== undefined
  }

  assertAvailable(modelName: string): void {
    if (!this.isAvailable(modelName)) {
      throw new Error(
        `Embedder ${modelName} is not configured on this deployment (set ${getHttpEmbedderUrlVariable(modelName)})`,
      )
    }
  }

  async embedDocuments({
    modelName,
    texts,
  }: {
    modelName: string
    texts: string[]
  }): Promise<Embeddings> {
    if (texts.length === 0) return { dense: [], sparse: null }
    const httpConfig = this.resolveHttpConfigOrThrow(modelName)
    return httpConfig
      ? this.embedDocumentsOverHttp({ modelName, texts, config: httpConfig })
      : this.embedDocumentsWithVertex({ modelName, texts })
  }

  async embedQuery({
    modelName,
    text,
  }: {
    modelName: string
    text: string
  }): Promise<QueryEmbedding> {
    const httpConfig = this.resolveHttpConfigOrThrow(modelName)
    if (!httpConfig) {
      const { project, location } = resolveVertexConfig()
      const { embedding } = await embed({
        model: createVertex({ project, location }).textEmbeddingModel(modelName),
        value: text,
      })
      return { embedding, sparseEmbedding: null }
    }

    const { dense, sparse } = await this.requestHttpEmbeddings({
      modelName,
      config: httpConfig,
      texts: [text],
      inputType: "query",
      timeoutMs: getEmbedderQueryTimeoutMs(),
    })
    const [embedding] = dense
    if (!embedding) {
      throw new Error(`Embedder ${modelName} returned no vector for the query`)
    }
    return { embedding, sparseEmbedding: sparse?.[0] ?? null }
  }

  private resolveHttpConfigOrThrow(modelName: string): HttpEmbedderConfig | undefined {
    if (!isLocalEmbeddingModel(modelName)) return undefined
    this.assertAvailable(modelName)
    return resolveHttpEmbedderConfig(modelName)
  }

  private async embedDocumentsWithVertex({
    modelName,
    texts,
  }: {
    modelName: string
    texts: string[]
  }): Promise<Embeddings> {
    const { project, location } = resolveVertexConfig()
    const batchSize = resolveMaxVertexEmbeddingBatchSize()
    this.logger.log(
      `Creating embeddings with Vertex model ${modelName} in project ${project}, location ${location}`,
    )
    const embeddingModel = createVertex({ project, location }).textEmbeddingModel(modelName)
    const dense: number[][] = []
    for (let batchStartIndex = 0; batchStartIndex < texts.length; batchStartIndex += batchSize) {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: texts.slice(batchStartIndex, batchStartIndex + batchSize),
      })
      dense.push(...embeddings)
    }
    return { dense, sparse: null }
  }

  private async embedDocumentsOverHttp({
    modelName,
    texts,
    config,
  }: {
    modelName: string
    texts: string[]
    config: HttpEmbedderConfig
  }): Promise<Embeddings> {
    this.logger.log(`Creating embeddings with embedder ${modelName}`)
    const batchSize = getEmbedderBatchSize()
    const timeoutMs = getEmbedderRequestTimeoutMs()
    const dense: number[][] = []
    const sparse: SparseWeights[] = []
    let hasSparse = false
    for (let batchStartIndex = 0; batchStartIndex < texts.length; batchStartIndex += batchSize) {
      const batch = await this.requestHttpEmbeddings({
        modelName,
        config,
        texts: texts.slice(batchStartIndex, batchStartIndex + batchSize),
        inputType: "document",
        timeoutMs,
      })
      dense.push(...batch.dense)
      if (batch.sparse) {
        hasSparse = true
        sparse.push(...batch.sparse)
      }
    }
    if (hasSparse && sparse.length !== dense.length) {
      throw new Error(
        `Embedder ${modelName} returned lexical weights for only some of the ${texts.length} texts`,
      )
    }
    return { dense, sparse: hasSparse ? sparse : null }
  }

  private async requestHttpEmbeddings({
    modelName,
    config,
    texts,
    inputType,
    timeoutMs,
  }: {
    modelName: string
    config: HttpEmbedderConfig
    texts: string[]
    inputType: EmbedderInputType
    timeoutMs: number
  }): Promise<Embeddings> {
    const body: HttpEmbedRequest = { model: modelName, texts, input_type: inputType }
    const response = await fetch(`${config.url}/v1/embed`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.apiKey && { authorization: `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500)
      throw new Error(`Embedder ${modelName} answered ${response.status}: ${detail}`)
    }

    const payload = (await response.json()) as Partial<HttpEmbedResponse>
    if (!Array.isArray(payload.dense) || payload.dense.length !== texts.length) {
      throw new Error(
        `Embedder ${modelName} returned ${Array.isArray(payload.dense) ? payload.dense.length : "no"} vectors for ${texts.length} texts`,
      )
    }
    const sparse = Array.isArray(payload.sparse) ? payload.sparse : null
    if (sparse && sparse.length !== texts.length) {
      throw new Error(
        `Embedder ${modelName} returned ${sparse.length} lexical weight maps for ${texts.length} texts`,
      )
    }
    return { dense: payload.dense, sparse }
  }
}

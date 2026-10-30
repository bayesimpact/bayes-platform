import { createVertex } from "@ai-sdk/google-vertex"
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
  isOpenAiCompatibleModel,
  resolveHttpEmbedderConfig,
} from "./embedders.config"
import type { OpenAiEmbeddingsRequest, OpenAiEmbeddingsResponse } from "./embedders.types"

/**
 * The one way the platform turns text into vectors, for chunks and queries alike, and the only
 * place where a model's provider matters. OpenAI-compatible models of the catalog are reached
 * through the OpenAI embeddings API (`POST {url}/v1/embeddings`), served by any compatible server;
 * every other model name is a Vertex model called through the AI SDK.
 */
@Injectable()
export class EmbedderService {
  private readonly logger = new Logger(EmbedderService.name)

  /** Vertex models are always there; an OpenAI-compatible model needs its URL in the environment. */
  isAvailable(modelName: string): boolean {
    return !isOpenAiCompatibleModel(modelName) || resolveHttpEmbedderConfig(modelName) !== undefined
  }

  assertAvailable(modelName: string): void {
    if (!this.isAvailable(modelName)) {
      throw new Error(
        `Embedder ${modelName} is not configured on this deployment (set ${getHttpEmbedderUrlVariable(modelName)})`,
      )
    }
  }

  /** One vector per text, in order. */
  async embedDocuments({
    modelName,
    texts,
  }: {
    modelName: string
    texts: string[]
  }): Promise<number[][]> {
    if (texts.length === 0) return []
    const httpConfig = this.resolveHttpConfigOrThrow(modelName)
    return httpConfig
      ? this.embedDocumentsOverHttp({ modelName, texts, config: httpConfig })
      : this.embedDocumentsWithVertex({ modelName, texts })
  }

  async embedQuery({ modelName, text }: { modelName: string; text: string }): Promise<number[]> {
    const httpConfig = this.resolveHttpConfigOrThrow(modelName)
    if (!httpConfig) {
      const { project, location } = resolveVertexConfig()
      const { embedding } = await embed({
        model: createVertex({ project, location }).textEmbeddingModel(modelName),
        value: text,
      })
      return embedding
    }

    const [embedding] = await this.requestHttpEmbeddings({
      modelName,
      config: httpConfig,
      texts: [text],
      timeoutMs: getEmbedderQueryTimeoutMs(),
    })
    if (!embedding) {
      throw new Error(`Embedder ${modelName} returned no vector for the query`)
    }
    return embedding
  }

  private resolveHttpConfigOrThrow(modelName: string): HttpEmbedderConfig | undefined {
    if (!isOpenAiCompatibleModel(modelName)) return undefined
    this.assertAvailable(modelName)
    return resolveHttpEmbedderConfig(modelName)
  }

  private async embedDocumentsWithVertex({
    modelName,
    texts,
  }: {
    modelName: string
    texts: string[]
  }): Promise<number[][]> {
    const { project, location } = resolveVertexConfig()
    const batchSize = resolveMaxVertexEmbeddingBatchSize()
    this.logger.log(
      `Creating embeddings with Vertex model ${modelName} in project ${project}, location ${location}`,
    )
    const embeddingModel = createVertex({ project, location }).textEmbeddingModel(modelName)
    const vectors: number[][] = []
    for (let batchStartIndex = 0; batchStartIndex < texts.length; batchStartIndex += batchSize) {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: texts.slice(batchStartIndex, batchStartIndex + batchSize),
      })
      vectors.push(...embeddings)
    }
    return vectors
  }

  private async embedDocumentsOverHttp({
    modelName,
    texts,
    config,
  }: {
    modelName: string
    texts: string[]
    config: HttpEmbedderConfig
  }): Promise<number[][]> {
    this.logger.log(`Creating embeddings with embedder ${modelName}`)
    const batchSize = getEmbedderBatchSize()
    const timeoutMs = getEmbedderRequestTimeoutMs()
    const vectors: number[][] = []
    for (let batchStartIndex = 0; batchStartIndex < texts.length; batchStartIndex += batchSize) {
      vectors.push(
        ...(await this.requestHttpEmbeddings({
          modelName,
          config,
          texts: texts.slice(batchStartIndex, batchStartIndex + batchSize),
          timeoutMs,
        })),
      )
    }
    return vectors
  }

  private async requestHttpEmbeddings({
    modelName,
    config,
    texts,
    timeoutMs,
  }: {
    modelName: string
    config: HttpEmbedderConfig
    texts: string[]
    timeoutMs: number
  }): Promise<number[][]> {
    const body: OpenAiEmbeddingsRequest = {
      model: config.servedModelName,
      input: texts,
      encoding_format: "float",
    }
    const response = await fetch(`${config.url}/v1/embeddings`, {
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

    const payload = (await response.json()) as Partial<OpenAiEmbeddingsResponse>
    const data = Array.isArray(payload.data) ? payload.data : []
    if (data.length !== texts.length) {
      throw new Error(
        `Embedder ${modelName} returned ${data.length} vectors for ${texts.length} texts`,
      )
    }
    // The API may answer out of order: `index` is the position of the input.
    return [...data]
      .sort((first, second) => first.index - second.index)
      .map((item) => item.embedding)
  }
}

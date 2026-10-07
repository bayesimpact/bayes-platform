import { type EmbeddingModel, isLocalEmbeddingModel } from "@caseai-connect/api-contracts"
import { BadRequestException, ConflictException, Inject, Injectable, Logger } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
import type { ProjectEmbeddingModelProgressFields } from "./project-embedding-model.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"
import { MAX_PROJECT_EMBEDDING_MODEL_ERROR_LENGTH } from "./project-embedding-reembed.constants"
import {
  PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE,
  type ProjectEmbeddingReembedBatchService,
} from "./project-embedding-reembed-batch.interface"

export const EMBEDDING_MODEL_NOT_LOCAL_ERROR_MESSAGE =
  "Only local embedding models can be enabled on a project."
export const EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE =
  "This embedding model is already being processed for the project."

@Injectable()
export class ProjectEmbeddingModelsService {
  private readonly logger = new Logger(ProjectEmbeddingModelsService.name)

  constructor(
    private readonly projectEmbeddingModelRepository: ProjectEmbeddingModelRepository,
    @Inject(PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE)
    private readonly reembedBatchService: ProjectEmbeddingReembedBatchService,
  ) {}

  async list(connectScope: RequiredConnectScope): Promise<ProjectEmbeddingModel[]> {
    return this.projectEmbeddingModelRepository.findAllByScope(connectScope)
  }

  /**
   * Enables a local model on the project and launches the job that embeds the existing chunks.
   * A completed model is returned as is, a failed one is retried, a running one is refused.
   */
  async enable({
    connectScope,
    modelName,
  }: {
    connectScope: RequiredConnectScope
    modelName: EmbeddingModel
  }): Promise<ProjectEmbeddingModel> {
    if (!isLocalEmbeddingModel(modelName)) {
      throw new BadRequestException(EMBEDDING_MODEL_NOT_LOCAL_ERROR_MESSAGE)
    }

    const existing = await this.projectEmbeddingModelRepository.findOneByModelName(
      connectScope,
      modelName,
    )
    if (existing?.status === "completed") {
      return existing
    }
    if (existing?.status === "pending" || existing?.status === "processing") {
      throw new ConflictException(EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE)
    }

    const row = existing
      ? await this.projectEmbeddingModelRepository.updateProgress(existing.id, {
          status: "pending",
          error: null,
          totalChunks: 0,
          processedChunks: 0,
        })
      : await this.projectEmbeddingModelRepository.createPending(connectScope, modelName)
    if (!row) {
      throw new ConflictException(EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE)
    }

    await this.reembedBatchService.enqueueReembedProjectChunks({
      projectEmbeddingModelId: row.id,
      organizationId: row.organizationId,
      projectId: row.projectId,
      modelName: row.modelName,
    })
    this.logger.log(`Enabled embedding model ${modelName} on project ${row.projectId}`)
    return row
  }

  async findById(id: string): Promise<ProjectEmbeddingModel | null> {
    return this.projectEmbeddingModelRepository.findById(id)
  }

  async markProcessing({
    id,
    totalChunks,
    processedChunks,
  }: {
    id: string
    totalChunks: number
    processedChunks: number
  }): Promise<void> {
    await this.save(id, { status: "processing", totalChunks, processedChunks, error: null })
  }

  async updateProgress({
    id,
    processedChunks,
  }: {
    id: string
    processedChunks: number
  }): Promise<void> {
    await this.save(id, { processedChunks })
  }

  async markCompleted({
    id,
    totalChunks,
    processedChunks,
  }: {
    id: string
    totalChunks: number
    processedChunks: number
  }): Promise<void> {
    await this.save(id, { status: "completed", totalChunks, processedChunks, error: null })
  }

  /** Back to the queue without losing the counters, e.g. when a worker stops mid-job. */
  async markPending({ id }: { id: string }): Promise<void> {
    await this.save(id, { status: "pending", error: null })
  }

  async markFailed({ id, error }: { id: string; error: unknown }): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await this.save(id, {
      status: "failed",
      error: message.slice(0, MAX_PROJECT_EMBEDDING_MODEL_ERROR_LENGTH),
    })
  }

  private async save(id: string, fields: ProjectEmbeddingModelProgressFields): Promise<void> {
    await this.projectEmbeddingModelRepository.updateProgress(id, fields)
  }

  async listActiveModelNames(projectId: string): Promise<EmbeddingModel[]> {
    return this.projectEmbeddingModelRepository.listActiveModelNames(projectId)
  }

  async isCompleted(params: { projectId: string; modelName: EmbeddingModel }): Promise<boolean> {
    return this.projectEmbeddingModelRepository.isCompleted(params)
  }
}

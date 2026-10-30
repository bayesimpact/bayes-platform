import type { EmbeddingModel } from "@caseai-connect/api-contracts"
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { resolveEmbeddingModelNames } from "../document-embeddings.config"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EmbedderService } from "../embedders/embedder.service"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
import type { ProjectEmbeddingModelProgressFields } from "./project-embedding-model.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"
import { MAX_PROJECT_EMBEDDING_MODEL_ERROR_LENGTH } from "./project-embedding-reembed.constants"
import {
  PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE,
  type ProjectEmbeddingReembedBatchService,
} from "./project-embedding-reembed-batch.interface"

export const EMBEDDING_MODEL_NOT_CONFIGURED_ERROR_MESSAGE =
  "This embedding model has no embedder configured on this deployment."
export const EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE =
  "This embedding model is already being processed for the project."
export const EMBEDDING_MODEL_NOT_FOUND_ERROR_MESSAGE = "Embedding model not found for this project."
export const EMBEDDING_MODEL_NOT_READY_ERROR_MESSAGE =
  "This embedding model has not finished embedding the project's documents."

@Injectable()
export class ProjectEmbeddingModelsService {
  private readonly logger = new Logger(ProjectEmbeddingModelsService.name)

  constructor(
    private readonly projectEmbeddingModelRepository: ProjectEmbeddingModelRepository,
    @Inject(PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE)
    private readonly reembedBatchService: ProjectEmbeddingReembedBatchService,
    private readonly embedderService: EmbedderService,
    private readonly transactionService: TransactionService,
  ) {}

  async list(connectScope: RequiredConnectScope): Promise<ProjectEmbeddingModel[]> {
    await this.ensureProjectModels(connectScope)
    return this.projectEmbeddingModelRepository.findAllByScope(connectScope)
  }

  /**
   * A project starts with the models of the deployment (`DOCUMENT_EMBEDDING_MODELS`, the first
   * as default), completed since it has no chunk yet. Done on first read rather than at project
   * creation, so every way of creating a project is covered.
   */
  async ensureProjectModels(connectScope: RequiredConnectScope): Promise<void> {
    if (await this.projectEmbeddingModelRepository.hasAny(connectScope.projectId)) return
    await this.projectEmbeddingModelRepository.createCompletedIgnoringConflicts(
      connectScope,
      resolveEmbeddingModelNames() as EmbeddingModel[],
    )
  }

  /**
   * Enables a model on the project and launches the job that embeds the existing chunks.
   * A completed model is returned as is, a failed or stuck one is retried, a running one is refused.
   */
  async enable({
    connectScope,
    modelName,
  }: {
    connectScope: RequiredConnectScope
    modelName: EmbeddingModel
  }): Promise<ProjectEmbeddingModel> {
    if (!this.embedderService.isAvailable(modelName)) {
      throw new UnprocessableEntityException(EMBEDDING_MODEL_NOT_CONFIGURED_ERROR_MESSAGE)
    }
    // A new project first gets the deployment's models, so the enabled one never stands alone
    // without a default.
    await this.ensureProjectModels(connectScope)

    const existing = await this.projectEmbeddingModelRepository.findOneByModelName(
      connectScope,
      modelName,
    )
    if (existing?.status === "completed") {
      return existing
    }
    // A pending or processing row whose job is gone (enqueue failure, retries exhausted, lost
    // worker) would otherwise stay stuck: only a row with a live job refuses a new one.
    if (
      (existing?.status === "pending" || existing?.status === "processing") &&
      (await this.reembedBatchService.isReembedJobQueued(existing.id))
    ) {
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

    try {
      await this.reembedBatchService.enqueueReembedProjectChunks({
        projectEmbeddingModelId: row.id,
        organizationId: row.organizationId,
        projectId: row.projectId,
        modelName: row.modelName,
      })
    } catch (enqueueError) {
      // Failed rather than pending, so the studio offers a retry instead of a spinner.
      await this.markFailed({ id: row.id, error: enqueueError })
      throw enqueueError
    }
    this.logger.log(`Enabled embedding model ${modelName} on project ${row.projectId}`)
    return row
  }

  /** Makes a completed model the one new agents of the project search with. */
  async setDefault({
    connectScope,
    projectEmbeddingModelId,
  }: {
    connectScope: RequiredConnectScope
    projectEmbeddingModelId: string
  }): Promise<ProjectEmbeddingModel> {
    const row = await this.projectEmbeddingModelRepository.findOneById(
      connectScope,
      projectEmbeddingModelId,
    )
    if (!row) throw new NotFoundException(EMBEDDING_MODEL_NOT_FOUND_ERROR_MESSAGE)
    if (row.status !== "completed") {
      throw new UnprocessableEntityException(EMBEDDING_MODEL_NOT_READY_ERROR_MESSAGE)
    }
    if (row.isDefault) return row
    await this.transactionService.run(() =>
      this.projectEmbeddingModelRepository.setDefault(connectScope, row.id),
    )
    return { ...row, isDefault: true }
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

  /** Models new chunks of the project are embedded with. */
  async listActiveModelNames(connectScope: RequiredConnectScope): Promise<EmbeddingModel[]> {
    await this.ensureProjectModels(connectScope)
    return this.projectEmbeddingModelRepository.listActiveModelNames(connectScope.projectId)
  }

  /** Models agents of the project can search with, the default first. */
  async listCompletedModelNames(connectScope: RequiredConnectScope): Promise<EmbeddingModel[]> {
    await this.ensureProjectModels(connectScope)
    return this.projectEmbeddingModelRepository.listCompletedModelNames(connectScope.projectId)
  }

  /** The model a new agent of the project searches with. */
  async resolveDefaultModelName(connectScope: RequiredConnectScope): Promise<EmbeddingModel> {
    await this.ensureProjectModels(connectScope)
    const defaultModelName = await this.projectEmbeddingModelRepository.findDefaultModelName(
      connectScope.projectId,
    )
    const [firstCompleted] = await this.projectEmbeddingModelRepository.listCompletedModelNames(
      connectScope.projectId,
    )
    const modelName = defaultModelName ?? firstCompleted
    if (!modelName) {
      throw new UnprocessableEntityException(EMBEDDING_MODEL_NOT_READY_ERROR_MESSAGE)
    }
    return modelName
  }
}

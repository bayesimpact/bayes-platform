import { type EmbeddingModel, isLocalEmbeddingModel } from "@caseai-connect/api-contracts"
import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"

export const EMBEDDING_MODEL_NOT_LOCAL_ERROR_MESSAGE =
  "Only local embedding models can be enabled on a project."
export const EMBEDDING_MODEL_ALREADY_PROCESSING_ERROR_MESSAGE =
  "This embedding model is already being processed for the project."

@Injectable()
export class ProjectEmbeddingModelsService {
  private readonly logger = new Logger(ProjectEmbeddingModelsService.name)

  constructor(private readonly projectEmbeddingModelRepository: ProjectEmbeddingModelRepository) {}

  async list(connectScope: RequiredConnectScope): Promise<ProjectEmbeddingModel[]> {
    return this.projectEmbeddingModelRepository.findAllByScope(connectScope)
  }

  /**
   * Enables a local model on the project. The row starts `pending`; the job that embeds the
   * project's chunks with it picks it up from there. A completed model is returned as is, a
   * failed one is retried, a running one is refused.
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

    this.logger.log(`Enabled embedding model ${modelName} on project ${row.projectId}`)
    return row
  }

  async listActiveModelNames(projectId: string): Promise<EmbeddingModel[]> {
    return this.projectEmbeddingModelRepository.listActiveModelNames(projectId)
  }

  async isCompleted(params: { projectId: string; modelName: EmbeddingModel }): Promise<boolean> {
    return this.projectEmbeddingModelRepository.isCompleted(params)
  }
}

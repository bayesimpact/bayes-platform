import type { EmbeddingModel, ProjectEmbeddingModelStatus } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { ProjectEmbeddingModel } from "./project-embedding-model.entity"

/** Statuses under which new uploads must also be embedded with the model. */
const ACTIVE_STATUSES: ProjectEmbeddingModelStatus[] = ["pending", "processing", "completed"]

export type ProjectEmbeddingModelProgressFields = Partial<
  Pick<ProjectEmbeddingModel, "status" | "totalChunks" | "processedChunks" | "error">
>

@Injectable()
export class ProjectEmbeddingModelRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findAllByScope(connectScope: RequiredConnectScope): Promise<ProjectEmbeddingModel[]> {
    return this.connectRepo().find(connectScope, { order: { createdAt: "ASC" } })
  }

  async findOneByModelName(
    connectScope: RequiredConnectScope,
    modelName: EmbeddingModel,
  ): Promise<ProjectEmbeddingModel | null> {
    const found = await this.connectRepo().find(connectScope, { where: { modelName } })
    return found[0] ?? null
  }

  async findById(id: string): Promise<ProjectEmbeddingModel | null> {
    return this.repo().findOne({ where: { id } })
  }

  /** Local models new chunks of the project must be embedded with, in enabling order. */
  async listActiveModelNames(projectId: string): Promise<EmbeddingModel[]> {
    const rows = await this.repo().find({
      where: { projectId, status: In(ACTIVE_STATUSES) },
      order: { createdAt: "ASC" },
    })
    return rows.map((row) => row.modelName)
  }

  async isCompleted({
    projectId,
    modelName,
  }: {
    projectId: string
    modelName: EmbeddingModel
  }): Promise<boolean> {
    return this.repo().exists({ where: { projectId, modelName, status: "completed" } })
  }

  async createPending(
    connectScope: RequiredConnectScope,
    modelName: EmbeddingModel,
  ): Promise<ProjectEmbeddingModel> {
    return this.connectRepo().createAndSave(connectScope, {
      modelName,
      status: "pending",
      totalChunks: 0,
      processedChunks: 0,
      error: null,
    })
  }

  /** Returns the saved row, or null when it no longer exists. */
  async updateProgress(
    id: string,
    fields: ProjectEmbeddingModelProgressFields,
  ): Promise<ProjectEmbeddingModel | null> {
    const row = await this.repo().findOne({ where: { id } })
    if (!row) return null
    Object.assign(row, fields)
    return this.repo().save(row)
  }

  private repo(): Repository<ProjectEmbeddingModel> {
    return this.transactionService.getManager().getRepository(ProjectEmbeddingModel)
  }

  private connectRepo(): ConnectRepository<ProjectEmbeddingModel> {
    return new ConnectRepository(this.repo(), "project_embedding_model")
  }
}

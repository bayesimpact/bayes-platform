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

  async findOneById(
    connectScope: RequiredConnectScope,
    id: string,
  ): Promise<ProjectEmbeddingModel | null> {
    const found = await this.connectRepo().find(connectScope, { where: { id } })
    return found[0] ?? null
  }

  async findById(id: string): Promise<ProjectEmbeddingModel | null> {
    return this.repo().findOne({ where: { id } })
  }

  /** Models new chunks of the project must be embedded with, in enabling order. */
  async listActiveModelNames(projectId: string): Promise<EmbeddingModel[]> {
    const rows = await this.repo().find({
      where: { projectId, status: In(ACTIVE_STATUSES) },
      order: { createdAt: "ASC" },
    })
    return rows.map((row) => row.modelName)
  }

  /** Models agents of the project can search with: the default first, then in enabling order. */
  async listCompletedModelNames(projectId: string): Promise<EmbeddingModel[]> {
    const rows = await this.repo().find({
      where: { projectId, status: "completed" },
      order: { isDefault: "DESC", createdAt: "ASC" },
    })
    return rows.map((row) => row.modelName)
  }

  async findDefaultModelName(projectId: string): Promise<EmbeddingModel | null> {
    const row = await this.repo().findOne({ where: { projectId, isDefault: true } })
    return row?.modelName ?? null
  }

  async hasAny(projectId: string): Promise<boolean> {
    return this.repo().exists({ where: { projectId } })
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
      isDefault: false,
    })
  }

  /**
   * Completed rows for a project with no chunk yet, the first model as default. Ignores rows
   * another request created meanwhile, so two first reads never fail on the unique indexes.
   */
  async createCompletedIgnoringConflicts(
    connectScope: RequiredConnectScope,
    modelNames: EmbeddingModel[],
  ): Promise<void> {
    if (modelNames.length === 0) return
    await this.repo()
      .createQueryBuilder()
      .insert()
      .values(
        modelNames.map((modelName, index) => ({
          organizationId: connectScope.organizationId,
          projectId: connectScope.projectId,
          modelName,
          status: "completed" as const,
          isDefault: index === 0,
        })),
      )
      .orIgnore()
      .execute()
  }

  /** Unsets the previous default first: the unique index allows one per project. */
  async setDefault(connectScope: RequiredConnectScope, id: string): Promise<void> {
    await this.repo().update(
      {
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        isDefault: true,
      },
      { isDefault: false },
    )
    await this.repo().update(
      { id, organizationId: connectScope.organizationId, projectId: connectScope.projectId },
      { isDefault: true },
    )
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

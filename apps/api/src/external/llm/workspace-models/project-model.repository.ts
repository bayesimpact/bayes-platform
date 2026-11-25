import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { ProjectModel } from "./project-model.entity"

export type ProjectModelRecord = { model: string; enabled: boolean }

@Injectable()
export class ProjectModelRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByProject(projectId: string): Promise<ProjectModelRecord[]> {
    const rows = await this.repo().find({ where: { projectId }, order: { model: "ASC" } })
    return rows.map((row) => ({ model: row.model, enabled: row.enabled }))
  }

  async upsert(params: { projectId: string; model: string; enabled: boolean }): Promise<void> {
    await this.repo().upsert(
      { projectId: params.projectId, model: params.model, enabled: params.enabled },
      { conflictPaths: ["projectId", "model"] },
    )
  }

  async deleteOne(params: { projectId: string; model: string }): Promise<void> {
    await this.repo().delete({ projectId: params.projectId, model: params.model })
  }

  /** Whether a live workspace has this id, so no row is written for a missing one. */
  async projectExists(projectId: string): Promise<boolean> {
    const rows: unknown[] = await this.transactionService
      .getManager()
      .query(`SELECT 1 FROM "project" WHERE "id" = $1 AND "deleted_at" IS NULL`, [projectId])
    return rows.length > 0
  }

  private repo(): Repository<ProjectModel> {
    return this.transactionService.getManager().getRepository(ProjectModel)
  }
}

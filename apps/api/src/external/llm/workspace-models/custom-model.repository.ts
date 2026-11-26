import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { CustomModel } from "./custom-model.entity"

export type CustomModelRecord = {
  id: string
  projectId: string
  name: string
  baseModel: string
  baseUrl: string
  apiKeyEncrypted: string | null
  servedModelName: string | null
  createdAt: Date
}

export type CustomModelFields = Omit<CustomModelRecord, "id" | "projectId" | "createdAt">

@Injectable()
export class CustomModelRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByProject(projectId: string): Promise<CustomModelRecord[]> {
    const rows = await this.repo().find({ where: { projectId }, order: { createdAt: "ASC" } })
    return rows.map(toRecord)
  }

  /** The model of this id in this workspace. Another workspace's model is not found. */
  async findOne(params: { projectId: string; id: string }): Promise<CustomModelRecord | null> {
    const row = await this.repo().findOne({ where: { projectId: params.projectId, id: params.id } })
    return row ? toRecord(row) : null
  }

  async create(params: { projectId: string; fields: CustomModelFields }): Promise<string> {
    const saved = await this.repo().save(
      this.repo().create({ projectId: params.projectId, ...params.fields }),
    )
    return saved.id
  }

  async update(params: { projectId: string; id: string; fields: CustomModelFields }) {
    await this.repo().update({ projectId: params.projectId, id: params.id }, params.fields)
  }

  async deleteOne(params: { projectId: string; id: string }): Promise<void> {
    await this.repo().delete({ projectId: params.projectId, id: params.id })
  }

  /** How many agents have a revision (draft, version or archive) on each model of the workspace. */
  async countAgentsByModel(projectId: string): Promise<Map<string, number>> {
    const rows: { customModelId: string; agentCount: string }[] = await this.transactionService
      .getManager()
      .query(
        `SELECT custom_model_id AS "customModelId", COUNT(DISTINCT agent_id) AS "agentCount"
         FROM "agent_settings"
         WHERE project_id = $1 AND custom_model_id IS NOT NULL AND deleted_at IS NULL
         GROUP BY custom_model_id`,
        [projectId],
      )
    return new Map(rows.map((row) => [row.customModelId, Number(row.agentCount)]))
  }

  /**
   * The model the revision of a call runs, when it is one its workspace added. The workspace is
   * checked again, so a call of another workspace never reaches this server.
   */
  async findForAgentRevision(params: {
    projectId: string
    agentId: string
    revision: number
  }): Promise<CustomModelRecord | null> {
    const rows: { id: string }[] = await this.transactionService.getManager().query(
      `SELECT custom_model.id
         FROM "agent_settings" AS settings
         JOIN "custom_model" AS custom_model ON custom_model.id = settings.custom_model_id
         WHERE settings.agent_id = $1 AND settings.revision = $2
           AND settings.project_id = $3 AND custom_model.project_id = $3`,
      [params.agentId, params.revision, params.projectId],
    )
    const id = rows[0]?.id
    return id ? this.findOne({ projectId: params.projectId, id }) : null
  }

  private repo(): Repository<CustomModel> {
    return this.transactionService.getManager().getRepository(CustomModel)
  }
}

function toRecord(row: CustomModel): CustomModelRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    baseModel: row.baseModel,
    baseUrl: row.baseUrl,
    apiKeyEncrypted: row.apiKeyEncrypted,
    servedModelName: row.servedModelName,
    createdAt: row.createdAt,
  }
}

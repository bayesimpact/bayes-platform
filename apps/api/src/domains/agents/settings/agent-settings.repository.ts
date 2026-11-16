import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { AgentSettingsFields } from "./agent.settings.types"
import { AgentSettings } from "./agent-settings.entity"

@Injectable()
export class AgentSettingsRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * The revision in production, or null when the agent has none: an agent that was never saved,
   * such as a fresh copy, only has a draft.
   */
  async findProduction(
    connectScope: RequiredConnectScope,
    agentId: string,
  ): Promise<AgentSettings | null> {
    const [production] = await this.connectRepo().find(connectScope, {
      where: { agentId, isProduction: true },
      take: 1,
    })
    return production ?? null
  }

  /** The newest revision of the agent, draft included, or null when it has none. */
  async findLatest(
    connectScope: RequiredConnectScope,
    agentId: string,
  ): Promise<AgentSettings | null> {
    return this.findLatestWhere(connectScope, { agentId })
  }

  /** The agents among `agentIds` that have a revision in production. */
  async findAgentIdsInProduction(
    connectScope: RequiredConnectScope,
    agentIds: readonly string[],
  ): Promise<string[]> {
    if (agentIds.length === 0) return []
    const productionSettings = await this.connectRepo().find(connectScope, {
      where: { agentId: In([...agentIds]), isProduction: true },
      select: { id: true, agentId: true },
    })
    return productionSettings.map((agentSettings) => agentSettings.agentId)
  }

  /**
   * Puts one revision of the agent in production and takes the previous one out. Two writes: call
   * it inside `transactionService.run()`, or the unique index may see two revisions in production.
   *
   * Raw SQL leaves `updated_at` alone: it tells when the version was written, and choosing the
   * production version changes neither of them.
   */
  async setProduction(
    connectScope: RequiredConnectScope,
    { agentId, agentSettingsId }: { agentId: string; agentSettingsId: string },
  ): Promise<void> {
    const { organizationId, projectId } = connectScope
    const manager = this.transactionService.getManager()
    await manager.query(
      `UPDATE "agent_settings" SET "is_production" = false
       WHERE "organization_id" = $1 AND "project_id" = $2 AND "agent_id" = $3
         AND "is_production" = true`,
      [organizationId, projectId, agentId],
    )
    await manager.query(
      `UPDATE "agent_settings" SET "is_production" = true
       WHERE "organization_id" = $1 AND "project_id" = $2 AND "agent_id" = $3 AND "id" = $4`,
      [organizationId, projectId, agentId, agentSettingsId],
    )
  }

  /** A draft revision of the agent: no live session runs it until it is published. */
  async createDraft(
    connectScope: RequiredConnectScope,
    fields: { agentId: string; revision: number } & AgentSettingsFields,
  ): Promise<AgentSettings> {
    return this.connectRepo().createAndSave(connectScope, { ...fields, isDraft: true })
  }

  private async findLatestWhere(
    connectScope: RequiredConnectScope,
    where: { agentId: string },
  ): Promise<AgentSettings | null> {
    const [latest] = await this.connectRepo().find(connectScope, {
      where: { ...where, isArchived: false },
      order: { revision: "DESC" },
      take: 1,
    })
    return latest ?? null
  }

  private repo(): Repository<AgentSettings> {
    return this.transactionService.getManager().getRepository(AgentSettings)
  }

  private connectRepo(): ConnectRepository<AgentSettings> {
    return new ConnectRepository(this.repo(), "agentSettings")
  }
}

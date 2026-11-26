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
      // The flag never sits on a draft or an archived revision; the filter keeps it that way
      // even if a row breaks the rule.
      where: { agentId, isProduction: true, isDraft: false, isArchived: false },
      take: 1,
    })
    return production ?? null
  }

  /**
   * The newest saved revision of the agent, or null when it has none. A new draft starts as a
   * copy of it. It is not the production revision when the managers keep an older one live.
   */
  async findLatestSaved(
    connectScope: RequiredConnectScope,
    agentId: string,
  ): Promise<AgentSettings | null> {
    return this.findLatestWhere(connectScope, { agentId, isDraft: false })
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
      where: { agentId: In([...agentIds]), isProduction: true, isDraft: false, isArchived: false },
      select: { id: true, agentId: true },
    })
    return productionSettings.map((agentSettings) => agentSettings.agentId)
  }

  /** The agent of each revision among `agentSettingsIds`, by revision id. */
  async findAgentIdsBySettingsIds(
    connectScope: RequiredConnectScope,
    agentSettingsIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (agentSettingsIds.length === 0) return new Map()
    const revisions = await this.connectRepo().find(connectScope, {
      where: { id: In([...agentSettingsIds]) },
      select: { id: true, agentId: true },
    })
    return new Map(revisions.map((agentSettings) => [agentSettings.id, agentSettings.agentId]))
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

  /**
   * Reads a draft and locks its row until the ambient transaction ends. Postgres then holds back
   * every write that would point a session or a run at this draft, and every other change to it.
   * Null when the draft is gone. Call it inside `transactionService.run()`.
   */
  async findDraftForUpdate(
    connectScope: RequiredConnectScope,
    agentSettingsId: string,
  ): Promise<AgentSettings | null> {
    return this.repo().findOne({
      where: {
        id: agentSettingsId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        isDraft: true,
      },
      lock: { mode: "pessimistic_write" },
    })
  }

  /**
   * Points every session, run and campaign that ran on a revision at another one. Their foreign
   * keys cascade: deleting a revision something still points at would delete it too. The tables
   * come from the entity metadata, so a new table that points at a revision is covered at once.
   * Call it inside `transactionService.run()`.
   */
  async moveRunsToRevision({
    fromAgentSettingsId,
    toAgentSettingsId,
  }: {
    fromAgentSettingsId: string
    toAgentSettingsId: string
  }): Promise<void> {
    const manager = this.transactionService.getManager()
    for (const metadata of manager.connection.entityMetadatas) {
      for (const foreignKey of metadata.foreignKeys) {
        if (foreignKey.referencedEntityMetadata.target !== AgentSettings) continue
        const [column] = foreignKey.columns
        if (!column) continue
        // A plain update also moves the soft-deleted rows, which the cascade would delete as well.
        await manager
          .createQueryBuilder()
          .update(metadata.target)
          .set({ [column.propertyName]: toAgentSettingsId })
          .where(`${column.databaseName} = :fromAgentSettingsId`, { fromAgentSettingsId })
          .execute()
      }
    }
  }

  /** Removes a draft for good, so the next draft takes its revision number. */
  async deleteDraft(connectScope: RequiredConnectScope, agentSettingsId: string): Promise<void> {
    await this.repo().delete({
      id: agentSettingsId,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      isDraft: true,
    })
  }

  private async findLatestWhere(
    connectScope: RequiredConnectScope,
    where: { agentId: string; isDraft?: false },
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

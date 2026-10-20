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
   * The newest published revision of the agent, or null when it has none: an agent that was never
   * published, such as a fresh copy, only has a draft.
   */
  async findLatestPublished(
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

  /** The agents among `agentIds` that have a published revision. */
  async findAgentIdsWithPublishedRevision(
    connectScope: RequiredConnectScope,
    agentIds: readonly string[],
  ): Promise<string[]> {
    if (agentIds.length === 0) return []
    const publishedSettings = await this.connectRepo().find(connectScope, {
      where: { agentId: In([...agentIds]), isDraft: false, isArchived: false },
      select: { id: true, agentId: true },
    })
    return [...new Set(publishedSettings.map((agentSettings) => agentSettings.agentId))]
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

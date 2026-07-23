import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { requiresNewAgentSettingsRevision } from "@/domains/agents/settings/agent.settings.functions"
import { AgentSettings } from "./agent-settings.entity"

export type AgentSettingsValues = Pick<
  AgentSettings,
  | "instructions"
  | "model"
  | "temperature"
  | "locale"
  | "documentsRagMode"
  | "greetingMessage"
  | "outputJsonSchema"
  | "fillFormEnabled"
>

@Injectable()
export class AgentSettingsService {
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>
  constructor(
    @InjectRepository(AgentSettings)
    agentSettingsRepository: Repository<AgentSettings>,
  ) {
    this.agentSettingsConnectRepository = new ConnectRepository(agentSettingsRepository, "agents")
  }

  async get({
    connectScope,
    agentId,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
  }): Promise<AgentSettings | undefined> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, revision },
    })
    if (found.length > 0) {
      return found[0]
    }
    return undefined
  }
  private async getLastOrUndefined({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings | undefined> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId },
      order: { revision: "DESC" },
    })
    return found[0]
  }
  async getLast({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings> {
    const last = await this.getLastOrUndefined({ connectScope, agentId })
    if (!last) throw new NotFoundException(`AgentSettings with agentId ${agentId} not found`)
    return last
  }

  async getAll({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings[]> {
    return await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId },
      order: { revision: "DESC" },
    })
  }

  async createSettingsIfChanged({
    connectScope,
    agentId,
    agentSettings,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    agentSettings: Partial<AgentSettingsValues>
  }): Promise<AgentSettings> {
    const last = await this.getLastOrUndefined({ connectScope, agentId })
    let previousSettings:
      | Omit<AgentSettings, "id" | "createdAt" | "updatedAt" | "deletedAt">
      | undefined
    let revision: number
    if (last) {
      if (
        !requiresNewAgentSettingsRevision({
          initialAgentSettings: last,
          modifiedAgentSettings: {
            ...agentSettings,
            ...(agentSettings.temperature !== undefined && {
              // temperature: Number(agentSettings.temperature.toFixed(2)),
              temperature: agentSettings.temperature,
            }),
          },
        })
      )
        return last

      revision = last.revision + 1
      const { id, createdAt, updatedAt, deletedAt, ...cleanedSettings } = last
      previousSettings = cleanedSettings
    } else {
      revision = 1
    }

    return await this.agentSettingsConnectRepository.createAndSave(connectScope, {
      ...(previousSettings ?? {}),
      ...agentSettings,
      revision,
      agentId,
    })
  }
}

import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, Not, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { requiresUpdateAgentSettings } from "@/domains/agents/settings/agent.settings.functions"
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
    includesDraft,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft: boolean
  }): Promise<AgentSettings | undefined> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, ...(includesDraft ? {} : { isDraft: false }), isArchived: false },
      order: { revision: "DESC" },
    })
    return found[0]
  }
  async getLast({
    connectScope,
    agentId,
    includesDraft = false,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft?: boolean
  }): Promise<AgentSettings> {
    const last = await this.getLastOrUndefined({ connectScope, agentId, includesDraft })
    if (!last) throw new NotFoundException(`AgentSettings with agentId ${agentId} not found`)
    return last
  }

  async getAll({
    connectScope,
    agentId,
    includesDraft = false,
    includesArchived = false,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft?: boolean
    includesArchived?: boolean
  }): Promise<AgentSettings[]> {
    return await this.agentSettingsConnectRepository.find(connectScope, {
      where: {
        agentId,
        ...(includesDraft ? {} : { isDraft: false }),
        ...(includesArchived ? {} : { isArchived: false }),
      },
      order: { revision: "DESC" },
    })
  }

  /**
   * Revision identity for a set of settings ids. For callers that hold `agentSettingsId` foreign
   * keys (agent messages) rather than an agent id and revision number.
   *
   * `select` is narrowed on purpose: `agent_settings` rows carry `instructions` and
   * `outputJsonSchema`, which are arbitrarily large and unused by every caller of this method.
   */
  async getByIds({
    connectScope,
    ids,
  }: {
    connectScope: RequiredConnectScope
    ids: string[]
  }): Promise<Pick<AgentSettings, "id" | "revision" | "revisionName" | "isDraft">[]> {
    if (ids.length === 0) return []
    return this.agentSettingsConnectRepository.find(connectScope, {
      where: { id: In(ids) },
      select: { id: true, revision: true, revisionName: true, isDraft: true },
    })
  }

  /**
   * Writes revision 1 as already published, in a single row. Used by `createAgent`: a brand new
   * agent must have a readable revision from the moment it exists, since every runtime read
   * (playground sessions, streaming, extraction, campaigns, eval runs) goes through `getLast`,
   * which excludes drafts by default. Do not route through `updateSettings` here: that would open
   * a draft first and require a second write to publish it.
   */
  async createInitialRevision({
    connectScope,
    agentId,
    agentSettings,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    agentSettings: Partial<AgentSettingsValues>
  }): Promise<AgentSettings> {
    return await this.agentSettingsConnectRepository.createAndSave(connectScope, {
      ...agentSettings,
      revision: 1,
      agentId,
      isDraft: false,
    })
  }

  async publish({
    connectScope,
    agentId,
    revision,
    revisionName,
    revisionDesc,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
    revisionName?: string | null
    revisionDesc?: string | null
  }): Promise<AgentSettings | undefined> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, revision },
    })
    if (!found || found.length !== 1 || !found[0]) return undefined
    // if (!found[0].isDraft) return undefined  => disable check so we can call publish again to update name and/or desc
    if (found[0].isArchived) return undefined
    const toUpdate: AgentSettings = found[0]
    // A string sets, `null` clears, `undefined` (an omitted field) preserves what is stored.
    if (revisionName !== undefined) toUpdate.revisionName = revisionName
    if (revisionDesc !== undefined) toUpdate.revisionDesc = revisionDesc
    toUpdate.isDraft = false

    const updated = await this.agentSettingsConnectRepository.updateOneById({
      connectScope,
      id: toUpdate.id,
      fields: { ...toUpdate },
    })
    if (!updated) return undefined

    return toUpdate
  }

  async archive({
    connectScope,
    agentId,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
  }): Promise<{ success: boolean }> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, revision },
    })
    if (!found || found.length !== 1) return { success: false }
    if (!found[0] || found[0].isDraft) return { success: false }

    // An agent must always have at least one non-archived published revision for `getLast` to
    // find, so refuse to archive this one if no other published, non-archived revision would
    // remain.
    const otherPublishedRevisions = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, isDraft: false, isArchived: false, revision: Not(revision) },
    })
    if (otherPublishedRevisions.length === 0) return { success: false }

    return this.agentSettingsConnectRepository.updateOneById({
      connectScope,
      id: found[0].id,
      fields: { isArchived: true },
    })
  }

  async updateSettings({
    connectScope,
    agentId,
    agentSettings,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    agentSettings: Partial<AgentSettingsValues>
  }): Promise<AgentSettings> {
    const last = await this.getLastOrUndefined({ connectScope, agentId, includesDraft: true })
    let previousSettings:
      | Omit<
          AgentSettings,
          "id" | "createdAt" | "updatedAt" | "deletedAt" | "revisionName" | "revisionDesc"
        >
      | undefined
    let revision: number
    let isDraft: boolean = false
    if (last) {
      if (
        !requiresUpdateAgentSettings({
          initialAgentSettings: last,
          modifiedAgentSettings: {
            ...agentSettings,
            ...(agentSettings.temperature !== undefined && {
              temperature: agentSettings.temperature,
            }),
          },
        })
      )
        return last

      isDraft = last.isDraft
      if (isDraft) revision = last.revision
      else revision = last.revision + 1

      const {
        id,
        createdAt,
        updatedAt,
        deletedAt,
        revisionName,
        revisionDesc,
        ...cleanedSettings
      } = last
      previousSettings = cleanedSettings
    } else {
      revision = 1
    }

    if (isDraft && last) {
      await this.agentSettingsConnectRepository.updateOneById({
        connectScope,
        id: last.id,
        fields: {
          ...agentSettings,
        },
      })
      const updated = await this.agentSettingsConnectRepository.getOneById(connectScope, last.id)
      if (!updated) {
        throw new NotFoundException(`AgentSettings with id ${last.id} not found`)
      }
      return updated
    } else {
      return await this.agentSettingsConnectRepository.createAndSave(connectScope, {
        ...(previousSettings ?? {}),
        ...agentSettings,
        revision,
        agentId,
        isDraft: true,
      })
    }
  }
}

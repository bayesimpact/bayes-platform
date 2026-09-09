import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  extractAgentSettingsUpdateFields,
  requiresUpdateAgentSettings,
} from "@/domains/agents/settings/agent.settings.functions"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "@/domains/documents/tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "@/domains/documents/tags/document-tags.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "@/domains/resource-libraries/resource-libraries.service"
import type { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import { Agent } from "../agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "../session-categories/agent-session-categories.service"
import { ProjectAgentSessionCategory } from "../session-categories/project-agent-session-category.entity"
import type { AgentSettingsUpdateFields } from "./agent.settings.types"
import { AgentSettings } from "./agent-settings.entity"

@Injectable()
export class AgentSettingsService {
  private readonly agentConnectRepository: ConnectRepository<Agent>
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>

  constructor(
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,

    @InjectRepository(AgentSettings)
    private agentSettingsRepository: Repository<AgentSettings>,

    @InjectRepository(ProjectAgentSessionCategory)
    private readonly projectAgentSessionCategoryRepository: Repository<ProjectAgentSessionCategory>,

    private readonly agentSessionCategoriesService: AgentSessionCategoriesService,

    private readonly documentTagsService: DocumentTagsService,

    private readonly resourceLibrariesService: ResourceLibrariesService,
  ) {
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agents")
    this.agentSettingsConnectRepository = new ConnectRepository(agentSettingsRepository, "agents")
  }

  /** The exact settings row a run was pinned to, so a re-run uses the version it advertises. */
  async getById({
    connectScope,
    agentSettingsId,
  }: {
    connectScope: RequiredConnectScope
    agentSettingsId: string
  }): Promise<AgentSettings> {
    const found = await this.agentSettingsConnectRepository.getOneById(
      connectScope,
      agentSettingsId,
    )
    if (!found) throw new NotFoundException(`AgentSettings with id ${agentSettingsId} not found`)
    return found
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
  private async getMaxRevision(agentId: string): Promise<number> {
    const last = await this.agentSettingsRepository
      .createQueryBuilder("as")
      .where("as.agentId = :agentId", { agentId })
      .orderBy("as.revision", "DESC")
      .getOne()
    if (last) return last.revision
    return 0
  }

  private async getLastOrUndefined({
    connectScope,
    agentId,
    includesDraft,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft?: true
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
    includesDraft,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft?: true
  }): Promise<AgentSettings> {
    const last = await this.getLastOrUndefined({ connectScope, agentId, includesDraft })
    if (!last) throw new NotFoundException(`AgentSettings with agentId ${agentId} not found`)
    return last
  }

  async getAll({
    connectScope,
    agentId,
    includesDraft,
    includesArchived,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft?: true
    includesArchived?: true
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
    revisionName?: string
    revisionDesc?: string
  }): Promise<AgentSettings | undefined> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, revision },
    })
    if (!found || found.length !== 1 || !found[0]) return undefined
    // if (!found[0].isDraft) return undefined  => disable check so we can call publish again to update name and/or desc
    if (found[0].isArchived) return undefined
    const toUpdate: AgentSettings = found[0]
    toUpdate.revisionName = revisionName
    toUpdate.revisionDesc = revisionDesc
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

    const last = await this.getLastOrUndefined({ connectScope, agentId, includesDraft: true })
    if (last && last.revision === revision)
      throw new UnprocessableEntityException("Cannot archive the last revision")

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
    agentSettings: Partial<AgentSettingsUpdateFields>
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
      else {
        const rev = await this.getMaxRevision(agentId)
        revision = rev + 1
      }

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
      const rev = await this.getMaxRevision(agentId)
      revision = rev + 1
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

  async updateAllSettings({
    connectScope,
    agentId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    fieldsToUpdate: AgentSettingsUpdateFields &
      DocumentTagsUpdateFields &
      AgentProjectCategoriesUpdateFields &
      AgentResourceLibrariesUpdateFields
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const { tagsToAdd, tagsToRemove, projectAgentSessionCategoryIds, ...fields } = fieldsToUpdate

    let agentSettingsFieldsToUpdate = extractAgentSettingsUpdateFields(fields)

    agentSettingsFieldsToUpdate = {
      ...agentSettingsFieldsToUpdate,
      ...(agentSettingsFieldsToUpdate.greetingMessage !== undefined && {
        greetingMessage: this.normalizeGreetingMessage(agentSettingsFieldsToUpdate.greetingMessage),
      }),
    }

    const needsTags =
      agentSettingsFieldsToUpdate.documentsRagMode !== undefined ||
      fieldsToUpdate.tagsToAdd !== undefined ||
      fieldsToUpdate.tagsToRemove !== undefined
    const needsResourceLibraries = fieldsToUpdate.resourceLibraryIds !== undefined
    const relationsToLoad = [
      ...(needsTags ? ["documentTags"] : []),
      ...(needsResourceLibraries ? ["resourceLibraries"] : []),
    ]

    const agent = await this.agentConnectRepository.getOneById(
      connectScope,
      agentId,
      relationsToLoad.length > 0 ? { relations: relationsToLoad } : undefined,
    )
    if (!agent) {
      throw new NotFoundException(`Agent with id ${agentId} not found`)
    }

    const agentSettings = await this.getLast({
      connectScope,
      agentId,
      includesDraft: true,
    })

    const nextOutputJsonSchema =
      agentSettingsFieldsToUpdate.outputJsonSchema !== undefined
        ? agentSettingsFieldsToUpdate.outputJsonSchema
        : agentSettings.outputJsonSchema

    this.validateExtractionAgent({
      type: agent.type,
      outputJsonSchema: nextOutputJsonSchema,
    })

    const nextFillFormEnabled =
      agentSettingsFieldsToUpdate.fillFormEnabled !== undefined
        ? agentSettingsFieldsToUpdate.fillFormEnabled
        : agentSettings.fillFormEnabled

    this.validateFillFormAgent({
      fillFormEnabled: nextFillFormEnabled,
      outputJsonSchema: nextOutputJsonSchema,
    })

    if (needsTags) {
      const currentTags = agent.documentTags ?? []
      agent.documentTags = await this.resolveDocumentTags({
        currentTags,
        tagsToAdd,
        tagsToRemove,
      })
    }

    if (needsResourceLibraries) {
      agent.resourceLibraries = await this.resolveResourceLibraries({
        connectScope,
        resourceLibraryIds: fieldsToUpdate.resourceLibraryIds,
        agentType: agent.type,
      })
    }

    if (fieldsToUpdate.projectAgentSessionCategoryIds !== undefined) {
      const selectedProjectCategories = await this.resolveProjectAgentSessionCategories({
        projectId: connectScope.projectId,
        projectAgentSessionCategoryIds: fieldsToUpdate.projectAgentSessionCategoryIds,
        withDeleted: true,
      })
      await this.agentSessionCategoriesService.replaceActiveCategoriesForAgent(
        agent.id,
        selectedProjectCategories,
      )
    }

    const updatedAgent = await this.agentConnectRepository.saveOne(agent)
    updatedAgent.sessionCategories =
      await this.agentSessionCategoriesService.listActiveCategoriesForAgent(agent.id)

    const updatedAgentSettings = await this.updateSettings({
      connectScope,
      agentId: agent.id,
      agentSettings: {
        ...extractAgentSettingsUpdateFields(agentSettings),
        // `agentSettingsFieldsToUpdate.greetingMessage` is already normalized above and is only
        // present when the caller provided it, so omitting a per-tab field preserves the existing
        // greeting instead of wiping it. Sending `null` clears it.
        ...agentSettingsFieldsToUpdate,
      },
    })

    return { agent: updatedAgent, agentSettings: updatedAgentSettings }
  }

  validateExtractionAgent({
    type,
    outputJsonSchema,
  }: {
    type: Agent["type"]
    outputJsonSchema: AgentSettings["outputJsonSchema"]
  }): void {
    if (type === "extraction" && !outputJsonSchema) {
      throw new UnprocessableEntityException("Extraction agent requires outputJsonSchema")
    }
  }

  validateFillFormAgent({
    fillFormEnabled,
    outputJsonSchema,
  }: {
    fillFormEnabled: AgentSettings["fillFormEnabled"]
    outputJsonSchema: AgentSettings["outputJsonSchema"]
  }): void {
    if (fillFormEnabled && !outputJsonSchema) {
      throw new UnprocessableEntityException(
        "outputJsonSchema is required when the fillForm tool is enabled",
      )
    }
  }

  async resolveDocumentTags({
    currentTags,
    tagsToAdd,
    tagsToRemove,
  }: {
    currentTags: Agent["documentTags"]
    tagsToAdd?: string[]
    tagsToRemove?: string[]
  }) {
    return await this.documentTagsService.resolveTagChanges({
      currentTags,
      tagsToAdd,
      tagsToRemove,
    })
  }

  async resolveResourceLibraries({
    connectScope,
    resourceLibraryIds,
    agentType,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryIds?: string[]
    agentType: Agent["type"]
  }): Promise<ResourceLibrary[]> {
    if (!resourceLibraryIds || resourceLibraryIds.length === 0) return []

    if (agentType !== "conversation") {
      throw new UnprocessableEntityException(
        "Resource libraries can only be attached to conversation agents",
      )
    }

    const uniqueIds = [...new Set(resourceLibraryIds)]
    const resourceLibraries = await this.resourceLibrariesService.findResourceLibrariesByIds({
      connectScope,
      ids: uniqueIds,
    })

    if (resourceLibraries.length !== uniqueIds.length) {
      throw new UnprocessableEntityException("One or more resource libraries do not exist")
    }

    return resourceLibraries
  }

  async resolveProjectAgentSessionCategories({
    projectId,
    projectAgentSessionCategoryIds,
    withDeleted,
  }: {
    projectId: string
    projectAgentSessionCategoryIds: string[]
    withDeleted: boolean
  }): Promise<Array<Pick<ProjectAgentSessionCategory, "id" | "name">>> {
    if (projectAgentSessionCategoryIds.length === 0) {
      return []
    }

    const uniqueProjectAgentSessionCategoryIds = [...new Set(projectAgentSessionCategoryIds)]
    const projectCategories = await this.projectAgentSessionCategoryRepository.find({
      where: {
        id: In(uniqueProjectAgentSessionCategoryIds),
        projectId,
      },
      withDeleted,
      order: { name: "ASC" },
    })

    if (projectCategories.length !== uniqueProjectAgentSessionCategoryIds.length) {
      throw new UnprocessableEntityException("One or more session categories do not exist")
    }

    return projectCategories.map((projectCategory) => ({
      id: projectCategory.id,
      name: projectCategory.name,
    }))
  }

  normalizeGreetingMessage(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }
}

type AgentProjectCategoriesUpdateFields = {
  projectAgentSessionCategoryIds?: string[]
}

type AgentResourceLibrariesUpdateFields = {
  resourceLibraryIds?: string[]
}

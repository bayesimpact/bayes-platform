import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, In, type Repository } from "typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  extractAgentSettingsCreateFields,
  extractAgentSettingsUpdateFields,
} from "@/domains/agents/settings/agent.settings.functions"
import type {
  AgentSettingsCreateFields,
  AgentSettingsUpdateFields,
} from "@/domains/agents/settings/agent.settings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "../documents/tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "../documents/tags/document-tags.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "../resource-libraries/resource-libraries.service"
import type { ResourceLibrary } from "../resource-libraries/resource-library.entity"
import { Agent } from "./agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "./session-categories/agent-session-categories.service"
import { ProjectAgentSessionCategory } from "./session-categories/project-agent-session-category.entity"
import type { AgentSettings } from "./settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "./settings/agent-settings.service"

type AgentProjectCategoriesUpdateFields = {
  projectAgentSessionCategoryIds?: string[]
}

type AgentResourceLibrariesUpdateFields = {
  resourceLibraryIds?: string[]
}

@Injectable()
export class AgentsService {
  private readonly agentConnectRepository: ConnectRepository<Agent>

  constructor(
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectRepository(ProjectAgentSessionCategory)
    private readonly projectAgentSessionCategoryRepository: Repository<ProjectAgentSessionCategory>,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly documentTagsService: DocumentTagsService,
    private readonly resourceLibrariesService: ResourceLibrariesService,
    private readonly agentSessionCategoriesService: AgentSessionCategoriesService,
    private readonly agentMembershipsService: AgentMembershipsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agents")
  }

  /**
   * Creates a new agent for a project.
   */
  async createAgent({
    userId,
    connectScope,
    fields,
  }: {
    userId: string
    connectScope: RequiredConnectScope
    fields: Pick<RequiredConnectScope, never> &
      Pick<Agent, "name" | "type"> &
      AgentSettingsCreateFields &
      DocumentTagsUpdateFields &
      AgentProjectCategoriesUpdateFields &
      AgentResourceLibrariesUpdateFields
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    this.validateAgentName(fields.name)

    const outputJsonSchema = fields.outputJsonSchema || null
    this.validateExtractionAgent({ type: fields.type, outputJsonSchema })

    const greetingMessage = normalizeGreetingMessage(fields.greetingMessage)

    const { tagsToAdd, projectAgentSessionCategoryIds, resourceLibraryIds, ...agentFields } = fields
    const documentTags = await this.resolveDocumentTags({
      currentTags: [],
      tagsToAdd,
    })
    const resourceLibraries = await this.resolveResourceLibraries({
      connectScope,
      resourceLibraryIds,
      agentType: fields.type,
    })

    // Create the agent with defaults
    const agent = await this.agentConnectRepository.createAndSave(connectScope, {
      ...agentFields,
      type: agentFields.type,
      documentTags,
      resourceLibraries,

      //fixme DOO : to delete as the same time we delete the fields in db: it's just a security ...
      _deleted_model: agentFields.model,
      _deleted_locale: agentFields.locale,
      _deleted_defaultPrompt: agentFields.instructions,
      _deleted_temperature: agentFields.temperature,
      _deleted_documentsRagMode: agentFields.documentsRagMode,
      _deleted_outputJsonSchema: agentFields.outputJsonSchema,
      _deleted_greetingMessage: agentFields.greetingMessage,
    })
    const agentSettingsValues = extractAgentSettingsCreateFields(agentFields)
    const agentSettings = await this.agentSettingsService.createSettingsIfChanged({
      connectScope,
      agentId: agent.id,
      agentSettings: { ...agentSettingsValues, outputJsonSchema, greetingMessage },
    })

    if (projectAgentSessionCategoryIds !== undefined) {
      const selectedProjectCategories = await this.resolveProjectAgentSessionCategories({
        projectId: connectScope.projectId,
        projectAgentSessionCategoryIds,
        withDeleted: false,
      })
      await this.agentSessionCategoriesService.replaceActiveCategoriesForAgent(
        agent.id,
        selectedProjectCategories,
      )
      agent.sessionCategories =
        await this.agentSessionCategoriesService.listActiveCategoriesForAgent(agent.id)
    }

    await this.agentMembershipsService.createAgentOwnerMembership({
      agentId: agent.id,
      userId,
    })

    await this.agentMembershipsService.createAdminAgentMembershipsForProjectAdmins({
      agentId: agent.id,
      projectId: connectScope.projectId,
      excludeUserId: userId,
    })

    return { agent, agentSettings }
  }

  /**
   * Lists all agents for a project.
   */
  async listAgents({
    userId,
    connectScope,
  }: {
    userId: string
    connectScope: RequiredConnectScope
  }): Promise<Agent[]> {
    const memberships = await this.agentMembershipsService.listMembershipsForUser(userId)
    const agentIdsInScope = memberships
      .filter(
        (membership) =>
          membership.agent.projectId === connectScope.projectId &&
          membership.agent.organizationId === connectScope.organizationId,
      )
      .map((membership) => membership.agentId)

    if (agentIdsInScope.length === 0) {
      return []
    }

    return (
      await this.agentConnectRepository.find(connectScope, {
        where: { id: In(agentIdsInScope) },
        relations: {
          documentTags: true,
          resourceLibraries: true,
          sessionCategories: { conversationSessionCategories: true },
        },
      })
    )?.sort((agentA, agentB) => agentA.name.localeCompare(agentB.name))
  }

  /**
   * Finds an agent by its id.
   */
  async findAgentById({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<Agent | null> {
    return this.agentConnectRepository.getOneById(connectScope, agentId)
  }

  /**
   * Updates an agent.
   * Verifies that the user is an owner or admin of the agent's project's organization before updating.
   * Deletes playground sessions if configuration fields change.
   */
  async updateAgent({
    connectScope,
    agentId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    fieldsToUpdate: Pick<RequiredConnectScope, never> &
      Partial<Pick<Agent, "name" | "type">> &
      AgentSettingsUpdateFields &
      DocumentTagsUpdateFields &
      AgentProjectCategoriesUpdateFields &
      AgentResourceLibrariesUpdateFields
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const { name, type, tagsToAdd, tagsToRemove, projectAgentSessionCategoryIds, ...fields } =
      fieldsToUpdate

    let agentSettingsFieldsToUpdate = extractAgentSettingsUpdateFields(fields)
    agentSettingsFieldsToUpdate = {
      ...agentSettingsFieldsToUpdate,
      ...(agentSettingsFieldsToUpdate.greetingMessage !== undefined && {
        greetingMessage: normalizeGreetingMessage(agentSettingsFieldsToUpdate.greetingMessage),
      }),
    }

    this.validateAgentName(name)

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

    const agentSettings = await this.agentSettingsService.getLast({
      connectScope,
      agentId,
    })

    const nextType = type ?? agent.type
    const nextOutputJsonSchema =
      agentSettingsFieldsToUpdate.outputJsonSchema !== undefined
        ? agentSettingsFieldsToUpdate.outputJsonSchema
        : agentSettings.outputJsonSchema

    this.validateExtractionAgent({
      type: nextType,
      outputJsonSchema: nextOutputJsonSchema,
    })

    if (needsTags) {
      agent.documentTags = await this.resolveDocumentTags({
        currentTags: agent.documentTags ?? [],
        tagsToAdd: tagsToAdd,
        tagsToRemove: tagsToRemove,
      })
    }

    if (needsResourceLibraries) {
      agent.resourceLibraries = await this.resolveResourceLibraries({
        connectScope,
        resourceLibraryIds: fieldsToUpdate.resourceLibraryIds,
        agentType: nextType,
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

    Object.assign(agent, {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      //fixme DOO : to delete as the same time we delete the fields in db: it's just a security ...
      ...(agentSettingsFieldsToUpdate.model !== undefined && {
        _deleted_model: agentSettingsFieldsToUpdate.model,
      }),
      ...(agentSettingsFieldsToUpdate.locale !== undefined && {
        _deleted_locale: agentSettingsFieldsToUpdate.locale,
      }),
      ...(agentSettingsFieldsToUpdate.instructions !== undefined && {
        _deleted_defaultPrompt: agentSettingsFieldsToUpdate.instructions,
      }),
      ...(agentSettingsFieldsToUpdate.temperature !== undefined && {
        _deleted_temperature: agentSettingsFieldsToUpdate.temperature,
      }),
      ...(agentSettingsFieldsToUpdate.documentsRagMode !== undefined && {
        _deleted_documentsRagMode: agentSettingsFieldsToUpdate.documentsRagMode,
      }),
      ...(agentSettingsFieldsToUpdate.outputJsonSchema !== undefined && {
        _deleted_outputJsonSchema: agentSettingsFieldsToUpdate.outputJsonSchema,
      }),
      ...(agentSettingsFieldsToUpdate.greetingMessage !== undefined
        ? {
            _deleted_greetingMessage: normalizeGreetingMessage(
              agentSettingsFieldsToUpdate.greetingMessage,
            ),
          }
        : {
            _deleted_greetingMessage: null,
          }),
    })

    const updatedAgent = await this.agentConnectRepository.saveOne(agent)
    updatedAgent.sessionCategories =
      await this.agentSessionCategoriesService.listActiveCategoriesForAgent(agent.id)

    const updatedAgentSettings = await this.agentSettingsService.createSettingsIfChanged({
      connectScope,
      agentId: agent.id,
      agentSettings: {
        ...extractAgentSettingsUpdateFields(agentSettings),
        ...agentSettingsFieldsToUpdate,
        ...(agentSettingsFieldsToUpdate.greetingMessage !== undefined
          ? {
              greetingMessage: normalizeGreetingMessage(
                agentSettingsFieldsToUpdate.greetingMessage,
              ),
            }
          : {
              greetingMessage: null,
            }),
      },
    })

    return { agent: updatedAgent, agentSettings: updatedAgentSettings }
  }

  async deleteAgent(agent: Agent): Promise<void> {
    await this.dataSource.transaction(async (entityManager) => {
      const agentId = agent.id
      // Sweep everything directly scoped by agentId
      for (const entity of ALL_ENTITIES) {
        const hasAgentId = entityManager.connection
          .getMetadata(entity)
          .columns.some((column) => column.propertyName === "agentId")
        if (hasAgentId) {
          await entityManager.softDelete(entity, { agentId })
        }
      }

      await entityManager.softDelete(Agent, { id: agent.id })
    })
  }

  private validateAgentName(name: string | undefined): void {
    if (name !== undefined && name.length < 3) {
      throw new UnprocessableEntityException("Agent name must be at least 3 characters long")
    }
  }

  private validateExtractionAgent({
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

  private async resolveDocumentTags({
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

  private async resolveResourceLibraries({
    connectScope,
    resourceLibraryIds,
    agentType,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryIds?: string[]
    agentType: Agent["type"]
  }): Promise<ResourceLibrary[]> {
    if (!resourceLibraryIds || resourceLibraryIds.length === 0) return []

    if (agentType !== "conversation" && agentType !== "form") {
      throw new UnprocessableEntityException(
        "Resource libraries can only be attached to conversation or form agents",
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

  private async resolveProjectAgentSessionCategories({
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
}

function normalizeGreetingMessage(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

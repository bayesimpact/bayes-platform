import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { extractAgentSettingsCreateFields } from "@/domains/agents/settings/agent.settings.functions"
import type { AgentSettingsCreateFields } from "@/domains/agents/settings/agent.settings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "../documents/tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "../documents/tags/document-tags.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "../resource-libraries/resource-libraries.service"
import type { ResourceLibrary } from "../resource-libraries/resource-library.entity"
import { Agent } from "./agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "./agent.repository"
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
    private readonly transactionService: TransactionService,
    private readonly agentsRepository: AgentRepository,
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
    this.validateFillFormAgent({
      fillFormEnabled: fields.fillFormEnabled ?? false,
      outputJsonSchema,
    })

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
    })
    const agentSettingsValues = extractAgentSettingsCreateFields(agentFields)
    const agentSettings = await this.agentSettingsService.createInitialRevision({
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
          agentMcpServers: { mcpServer: true },
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
   * Renames an agent. Settings live on their own revisions (see AgentSettingsService) and the
   * agent's collections have their own replace methods below.
   */
  async updateAgent({
    connectScope,
    agentId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    fieldsToUpdate: Partial<Pick<Agent, "name">>
  }): Promise<Agent> {
    const { name } = fieldsToUpdate
    this.validateAgentName(name)

    const agent = await this.agentConnectRepository.getOneById(connectScope, agentId)
    if (!agent) {
      throw new NotFoundException(`Agent with id ${agentId} not found`)
    }

    if (name !== undefined) agent.name = name

    const updatedAgent = await this.agentConnectRepository.saveOne(agent)
    updatedAgent.sessionCategories =
      await this.agentSessionCategoriesService.listActiveCategoriesForAgent(agent.id)
    return updatedAgent
  }

  /** Replaces the agent's document tags with exactly the given ids. */
  async replaceDocumentTags({
    connectScope,
    agentId,
    documentTagIds,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    documentTagIds: string[]
  }): Promise<void> {
    const agent = await this.agentConnectRepository.getOneById(connectScope, agentId, {
      relations: ["documentTags"],
    })
    if (!agent) throw new NotFoundException(`Agent with id ${agentId} not found`)

    const currentTagIds = (agent.documentTags ?? []).map((tag) => tag.id)
    const tagsToAdd = documentTagIds.filter((tagId) => !currentTagIds.includes(tagId))
    const tagsToRemove = currentTagIds.filter((tagId) => !documentTagIds.includes(tagId))

    const resolvedDocumentTags = await this.resolveDocumentTags({
      currentTags: agent.documentTags ?? [],
      tagsToAdd,
      tagsToRemove,
    })

    // `resolveDocumentTags` silently drops unknown ids (it just looks up whatever matches),
    // so an id that doesn't resolve to a real tag would otherwise be dropped instead of
    // rejected. Compare against the deduplicated request to catch that case explicitly.
    const uniqueRequestedTagIds = new Set(documentTagIds)
    if (resolvedDocumentTags.length !== uniqueRequestedTagIds.size) {
      throw new UnprocessableEntityException("One or more document tags do not exist")
    }

    agent.documentTags = resolvedDocumentTags
    await this.agentConnectRepository.saveOne(agent)
  }

  /** Replaces the agent's resource libraries with exactly the given ids. */
  async replaceResourceLibraries({
    connectScope,
    agentId,
    resourceLibraryIds,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    resourceLibraryIds: string[]
  }): Promise<void> {
    const agent = await this.agentConnectRepository.getOneById(connectScope, agentId, {
      relations: ["resourceLibraries"],
    })
    if (!agent) throw new NotFoundException(`Agent with id ${agentId} not found`)

    agent.resourceLibraries = await this.resolveResourceLibraries({
      connectScope,
      resourceLibraryIds,
      agentType: agent.type,
    })
    await this.agentConnectRepository.saveOne(agent)
  }

  /** Replaces the agent's active session categories with exactly the given project category ids. */
  async replaceSessionCategories({
    connectScope,
    agentId,
    projectAgentSessionCategoryIds,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    projectAgentSessionCategoryIds: string[]
  }): Promise<void> {
    const selectedProjectCategories = await this.resolveProjectAgentSessionCategories({
      projectId: connectScope.projectId,
      projectAgentSessionCategoryIds,
      withDeleted: true,
    })
    await this.agentSessionCategoriesService.replaceActiveCategoriesForAgent(
      agentId,
      selectedProjectCategories,
    )
  }

  async deleteAgent(agent: Agent): Promise<void> {
    await this.transactionService.run(async () => {
      await this.agentsRepository.softDelete(agent.id)
      await this.agentMembershipsService.deleteMembership({ agentId: agent.id })
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

  private validateFillFormAgent({
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

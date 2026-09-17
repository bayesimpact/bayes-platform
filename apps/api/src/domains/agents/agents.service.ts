import { Injectable, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { extractAgentSettingsCreateFields } from "@/domains/agents/settings/agent.settings.functions"
import type { AgentSettingsCreateFields } from "@/domains/agents/settings/agent.settings.types"
import type { DocumentTagsUpdateFields } from "../documents/tags/document-tags.types"
import { Agent } from "./agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "./agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "./session-categories/agent-session-categories.service"
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
    private readonly agentSettingsService: AgentSettingsService,
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
    this.agentSettingsService.validateExtractionAgent({ type: fields.type, outputJsonSchema })
    this.agentSettingsService.validateFillFormAgent({
      fillFormEnabled: fields.fillFormEnabled ?? false,
      outputJsonSchema,
    })

    const greetingMessage = this.agentSettingsService.normalizeGreetingMessage(
      fields.greetingMessage,
    )

    const { tagsToAdd, projectAgentSessionCategoryIds, resourceLibraryIds, ...agentFields } = fields
    const documentTags = await this.agentSettingsService.resolveDocumentTags({
      currentTags: [],
      tagsToAdd,
    })
    const resourceLibraries = await this.agentSettingsService.resolveResourceLibraries({
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
    const agentSettings = await this.agentSettingsService.updateSettings({
      connectScope,
      agentId: agent.id,
      agentSettings: { ...agentSettingsValues, outputJsonSchema, greetingMessage },
    })

    if (projectAgentSessionCategoryIds !== undefined) {
      const selectedProjectCategories =
        await this.agentSettingsService.resolveProjectAgentSessionCategories({
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

    //first settings are automatically published
    const publishedAgentSettings = await this.agentSettingsService.publish({
      connectScope,
      agentId: agent.id,
      revision: agentSettings.revision,
      revisionName: "",
    })
    if (!publishedAgentSettings) {
      throw new UnprocessableEntityException(
        `Unable to publish revision ${agentSettings.revision} for agent with id ${agent.id}`,
      )
    }

    return { agent, agentSettings: publishedAgentSettings }
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
    relations,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    relations?: string[]
  }): Promise<Agent | null> {
    return this.agentConnectRepository.getOneById(connectScope, agentId, { relations })
  }

  /**
   * Updates an agent.
   * Verifies that the user is an owner or admin of the agent's project's organization before updating.
   * Deletes playground sessions if configuration fields change.
   */
  async updateAgentName({
    connectScope,
    agentId,
    name,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    name: Agent["name"]
  }): Promise<boolean> {
    this.validateAgentName(name)

    const isUpdated = await this.agentConnectRepository.updateOneById({
      connectScope,
      id: agentId,
      fields: { name },
    })
    return isUpdated.success
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
}

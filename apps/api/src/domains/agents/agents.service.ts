import { type AgentCreationType, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { Injectable, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { AgentSettingsCreateFields } from "@/domains/agents/settings/agent.settings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "../rbac/permission.service"
import { Agent } from "./agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "./agent.repository"
import { newAgentDefaults } from "./agent-defaults"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "./session-categories/agent-session-categories.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoryRepository } from "./session-categories/agent-session-category.repository"
import { AGENT_DEFAULT_MODELS } from "./settings/agent-models.service"
import type { AgentSettings } from "./settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "./settings/agent-settings.service"

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
    private readonly permissionService: PermissionService,
    private readonly agentSessionCategoryRepository: AgentSessionCategoryRepository,
  ) {
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agents")
  }

  /**
   * Creates a new agent for a project from its name and creation type (newAgentDefaults). Its
   * settings are a draft, as a copy's are: no live conversation runs it until someone publishes a
   * version in the studio. It runs on the default model with that model's options, searches all the
   * project's documents and gets every session category of the project. The MCP create_agent tool
   * may give its instructions, model, greeting and result schema.
   */
  async createAgent({
    userId,
    connectScope,
    fields,
  }: {
    userId: string
    connectScope: RequiredConnectScope
    fields: { name: string; type: AgentCreationType } & Partial<
      Pick<
        AgentSettingsCreateFields,
        "instructions" | "model" | "greetingMessage" | "outputJsonSchema"
      >
    >
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    this.validateAgentName(fields.name)

    const defaults = newAgentDefaults(fields.type)
    const outputJsonSchema = fields.outputJsonSchema ?? defaults.outputJsonSchema
    this.agentSettingsService.validateExtractionAgent({ type: defaults.type, outputJsonSchema })
    this.agentSettingsService.validateFillFormAgent({
      fillFormEnabled: defaults.fillFormEnabled,
      outputJsonSchema,
    })

    const model = fields.model ?? AGENT_DEFAULT_MODELS.agent
    const providerOptions = await this.agentSettingsService.resolveNewAgentModelOptions({
      connectScope,
      model,
      providerOptions: undefined,
    })
    const greetingMessage = this.agentSettingsService.normalizeGreetingMessage(
      fields.greetingMessage,
    )

    const agent = await this.agentConnectRepository.createAndSave(connectScope, {
      name: fields.name,
      type: defaults.type,
      documentTags: [],
      resourceLibraries: [],
    })
    const agentSettings = await this.agentSettingsService.updateSettings({
      connectScope,
      agentId: agent.id,
      agentSettings: {
        instructions: fields.instructions ?? defaults.instructions,
        model,
        providerOptions,
        documentsRagMode: DocumentsRagMode.All,
        fillFormEnabled: defaults.fillFormEnabled,
        outputJsonSchema,
        greetingMessage,
        embeddingModel: await this.agentSettingsService.resolveDefaultEmbeddingModel(connectScope),
      },
    })

    await this.agentSessionCategoryRepository.giveProjectCategories({
      projectId: connectScope.projectId,
      agentId: agent.id,
    })
    agent.sessionCategories = await this.agentSessionCategoriesService.listActiveCategoriesForAgent(
      agent.id,
    )

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
   * Lists the project's agents the user may read, with the user's permissions on each.
   */
  async listAgents({
    userId,
    connectScope,
  }: {
    userId: string
    connectScope: RequiredConnectScope
  }): Promise<{ agents: Agent[]; permissionsByAgentId: Map<string, string[]> }> {
    // Every agent the user holds a role on comes back, such as one they only review conversations of.
    const permissionsByAgentId = new Map(
      [
        ...(await this.permissionService.listResourcePermissions(userId, "agent.read")).entries(),
      ].filter(([, permissions]) => permissions.includes("agent.read")),
    )
    if (permissionsByAgentId.size === 0) {
      return { agents: [], permissionsByAgentId }
    }

    // The repository scope keeps the agents of this project only.
    const agents = (
      await this.agentConnectRepository.find(connectScope, {
        where: { id: In([...permissionsByAgentId.keys()]) },
        relations: {
          documentTags: true,
          resourceLibraries: true,
          sessionCategories: { conversationSessionCategories: true },
          agentMcpServers: { mcpServer: true },
        },
      })
    ).sort((agentA, agentB) => agentA.name.localeCompare(agentB.name))
    return { agents, permissionsByAgentId }
  }

  /** The user's permissions on one agent, such as the one they just created. */
  async listPermissionsOnAgent({
    userId,
    agentId,
  }: {
    userId: string
    agentId: string
  }): Promise<string[]> {
    return this.permissionService.listResourcePermissionsFor(userId, "agent.read", agentId)
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

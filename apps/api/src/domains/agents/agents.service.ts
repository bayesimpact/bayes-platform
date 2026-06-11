import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, In, type Repository } from "typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "../documents/tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "../documents/tags/document-tags.types"
import { Agent } from "./agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "./session-categories/agent-session-categories.service"
import { ProjectAgentSessionCategory } from "./session-categories/project-agent-session-category.entity"

type AgentProjectCategoriesUpdateFields = {
  projectAgentSessionCategoryIds?: string[]
}

@Injectable()
export class AgentsService {
  private readonly agentConnectRepository: ConnectRepository<Agent>

  constructor(
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectRepository(ProjectAgentSessionCategory)
    private readonly projectAgentSessionCategoryRepository: Repository<ProjectAgentSessionCategory>,
    private readonly documentTagsService: DocumentTagsService,
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
      Pick<
        Agent,
        "defaultPrompt" | "documentsRagMode" | "name" | "model" | "temperature" | "locale" | "type"
      > &
      Partial<Pick<Agent, "outputJsonSchema" | "greetingMessage">> &
      DocumentTagsUpdateFields &
      AgentProjectCategoriesUpdateFields
  }): Promise<Agent> {
    this.validateAgentName(fields.name)

    const outputJsonSchema = fields.outputJsonSchema || null
    this.validateExtractionAgent({ type: fields.type, outputJsonSchema })

    const greetingMessage = normalizeGreetingMessage(fields.greetingMessage)

    const { tagsToAdd, projectAgentSessionCategoryIds, ...agentFields } = fields
    const documentTags = await this.resolveDocumentTags({
      currentTags: [],
      tagsToAdd,
    })

    // Create the agent with defaults
    const agent = await this.agentConnectRepository.createAndSave(connectScope, {
      ...agentFields,
      type: agentFields.type,
      outputJsonSchema,
      greetingMessage,
      documentTags,
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

    return agent
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
    return (
      await this.agentConnectRepository.find(connectScope, {
        where: { agentMemberships: { userId } },
        relations: {
          documentTags: true,
          sessionCategories: { conversationSessionCategories: true },
        },
      })
    )?.sort((a, b) => a.name.localeCompare(b.name))
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
      Partial<
        Pick<
          Agent,
          | "name"
          | "defaultPrompt"
          | "greetingMessage"
          | "documentsRagMode"
          | "model"
          | "temperature"
          | "locale"
          | "type"
          | "outputJsonSchema"
        >
      > &
      DocumentTagsUpdateFields &
      AgentProjectCategoriesUpdateFields
  }): Promise<Agent> {
    const { name, defaultPrompt, documentsRagMode, model, temperature, locale, type } =
      fieldsToUpdate

    this.validateAgentName(name)

    const needsTags =
      documentsRagMode !== undefined ||
      fieldsToUpdate.tagsToAdd !== undefined ||
      fieldsToUpdate.tagsToRemove !== undefined
    const agent = await this.agentConnectRepository.getOneById(
      connectScope,
      agentId,
      needsTags ? { relations: ["documentTags"] } : undefined,
    )

    if (!agent) {
      throw new NotFoundException(`Agent with id ${agentId} not found`)
    }

    const nextType = type ?? agent.type
    const nextOutputJsonSchema =
      fieldsToUpdate.outputJsonSchema !== undefined
        ? fieldsToUpdate.outputJsonSchema
        : agent.outputJsonSchema

    this.validateExtractionAgent({
      type: nextType,
      outputJsonSchema: nextOutputJsonSchema,
    })

    if (needsTags) {
      agent.documentTags = await this.resolveDocumentTags({
        currentTags: agent.documentTags ?? [],
        tagsToAdd: fieldsToUpdate.tagsToAdd,
        tagsToRemove: fieldsToUpdate.tagsToRemove,
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
      ...(defaultPrompt !== undefined && { defaultPrompt }),
      ...(documentsRagMode !== undefined && { documentsRagMode }),
      ...(model !== undefined && { model }),
      ...(temperature !== undefined && { temperature }),
      ...(locale !== undefined && { locale }),
      ...(type !== undefined && { type }),
      ...(fieldsToUpdate.outputJsonSchema !== undefined && {
        outputJsonSchema: fieldsToUpdate.outputJsonSchema,
      }),
      ...(fieldsToUpdate.greetingMessage !== undefined && {
        greetingMessage: normalizeGreetingMessage(fieldsToUpdate.greetingMessage),
      }),
    })

    const updatedAgent = await this.agentConnectRepository.saveOne(agent)
    updatedAgent.sessionCategories =
      await this.agentSessionCategoriesService.listActiveCategoriesForAgent(agent.id)

    return updatedAgent
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
    outputJsonSchema: Agent["outputJsonSchema"]
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
  if (value === undefined) return null
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

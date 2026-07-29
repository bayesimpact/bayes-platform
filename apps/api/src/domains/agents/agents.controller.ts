import {
  type AgentDto,
  type AgentSubAgentDto,
  AgentSubAgentsRoutes,
  AgentsRoutes,
  createAgentSchema,
  replaceAgentSubAgentsSchema,
  updateAgentDocumentTagsSchema,
  updateAgentNameSchema,
  updateAgentResourceLibrariesSchema,
  updateAgentSessionCategoriesSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { Agent } from "./agent.entity"
import { AgentGuard } from "./agent.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "./agents.service"
import type { AgentSubAgent } from "./sub-agents/agent-sub-agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSubAgentsService } from "./sub-agents/agent-sub-agents.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, AgentGuard)
@RequireContext("organization", "project")
@Controller()
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentSubAgentsService: AgentSubAgentsService,
  ) {}

  @Post(AgentsRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "agent.create" })
  @UsePipes(new ZodValidationPipe(createAgentSchema))
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof AgentsRoutes.createOne.request,
  ): Promise<typeof AgentsRoutes.createOne.response> {
    const { agent } = await this.agentsService.createAgent({
      connectScope: getRequiredConnectScope(request),
      fields: payload,
      userId: request.user.id,
    })

    return { data: toAgentDto(agent) }
  }

  @Get(AgentsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof AgentsRoutes.getAll.response> {
    const agents = await this.agentsService.listAgents({
      userId: request.user.id,
      connectScope: getRequiredConnectScope(request),
    })
    return { data: agents.map(toAgentDto) }
  }

  @Patch(AgentsRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(updateAgentNameSchema))
  async updateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentsRoutes.updateOne.request,
  ): Promise<typeof AgentsRoutes.updateOne.response> {
    const agentId = request.agent.id

    await this.agentsService.updateAgent({
      connectScope: getRequiredConnectScope(request),
      agentId,
      fieldsToUpdate: payload,
    })

    return { data: { success: true } }
  }

  @Put(AgentsRoutes.updateDocumentTags.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(updateAgentDocumentTagsSchema))
  async updateDocumentTags(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentsRoutes.updateDocumentTags.request,
  ): Promise<typeof AgentsRoutes.updateDocumentTags.response> {
    await this.agentsService.replaceDocumentTags({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      documentTagIds: payload.documentTagIds,
    })
    return { data: { success: true } }
  }

  @Put(AgentsRoutes.updateResourceLibraries.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(updateAgentResourceLibrariesSchema))
  async updateResourceLibraries(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentsRoutes.updateResourceLibraries.request,
  ): Promise<typeof AgentsRoutes.updateResourceLibraries.response> {
    await this.agentsService.replaceResourceLibraries({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      resourceLibraryIds: payload.resourceLibraryIds,
    })
    return { data: { success: true } }
  }

  @Put(AgentsRoutes.updateSessionCategories.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(updateAgentSessionCategoriesSchema))
  async updateSessionCategories(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentsRoutes.updateSessionCategories.request,
  ): Promise<typeof AgentsRoutes.updateSessionCategories.response> {
    await this.agentsService.replaceSessionCategories({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      projectAgentSessionCategoryIds: payload.projectAgentSessionCategoryIds,
    })
    return { data: { success: true } }
  }

  @Get(AgentSubAgentsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  async getAllSubAgents(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentSubAgentsRoutes.getAll.response> {
    const subAgents = await this.agentSubAgentsService.listSubAgents({
      connectScope: getRequiredConnectScope(request),
      parentAgent: request.agent,
    })

    return { data: subAgents.map(toAgentSubAgentDto) }
  }

  @Put(AgentSubAgentsRoutes.updateAll.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.sub_agents.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(replaceAgentSubAgentsSchema))
  async updateAllSubAgents(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentSubAgentsRoutes.updateAll.request,
  ): Promise<typeof AgentSubAgentsRoutes.updateAll.response> {
    const subAgents = await this.agentSubAgentsService.replaceSubAgents({
      connectScope: getRequiredConnectScope(request),
      parentAgent: request.agent,
      subAgents: payload.subAgents,
    })

    return { data: subAgents.map(toAgentSubAgentDto) }
  }

  @Delete(AgentsRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("agent")
  @TrackActivity({ action: "agent.delete", entityFrom: "agent" })
  async deleteOne(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentsRoutes.deleteOne.response> {
    await this.agentsService.deleteAgent(request.agent)
    return { data: { success: true } }
  }
}

function toAgentSubAgentDto(entity: AgentSubAgent): AgentSubAgentDto {
  return {
    id: entity.id,
    parentAgentId: entity.parentAgentId,
    childAgentId: entity.childAgentId,
    toolName: entity.toolName,
    description: entity.description,
    enabled: entity.enabled,
    childAgent: entity.childAgent
      ? {
          id: entity.childAgent.id,
          name: entity.childAgent.name,
          type: entity.childAgent.type,
        }
      : undefined,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}

function toAgentDto(agent: Agent): AgentDto {
  return {
    id: agent.id,
    projectId: agent.projectId,
    name: agent.name,
    type: agent.type,
    createdAt: agent.createdAt.getTime(),
    updatedAt: agent.updatedAt.getTime(),
    hasCategories: (agent.sessionCategories?.length ?? 0) > 0,
    documentTagIds: agent.documentTags?.map((tag) => tag.id) ?? [],
    resourceLibraryIds: agent.resourceLibraries?.map((library) => library.id) ?? [],
    projectAgentSessionCategoryIds: (agent.sessionCategories ?? [])
      .map((category) => category.projectAgentSessionCategoryId)
      .filter(
        (projectAgentSessionCategoryId): projectAgentSessionCategoryId is string =>
          projectAgentSessionCategoryId !== null,
      ),
    usedProjectAgentSessionCategoryIds: (agent.sessionCategories ?? [])
      .filter((category) => (category.conversationSessionCategories?.length ?? 0) > 0)
      .map((category) => category.projectAgentSessionCategoryId)
      .filter(
        (projectAgentSessionCategoryId): projectAgentSessionCategoryId is string =>
          projectAgentSessionCategoryId !== null,
      ),
    mcpServers: (agent.agentMcpServers ?? []).map((agentMcpServer) => ({
      id: agentMcpServer.mcpServer.id,
      name: agentMcpServer.mcpServer.name,
      enabled: agentMcpServer.enabled,
    })),
  }
}

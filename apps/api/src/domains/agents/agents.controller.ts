import {
  type AgentDto,
  type AgentSubAgentDto,
  AgentSubAgentsRoutes,
  AgentsRoutes,
  createAgentSchema,
  replaceAgentSubAgentsSchema,
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
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
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
    private readonly agentSettingsService: AgentSettingsService,
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
    const { agent, agentSettings } = await this.agentsService.createAgent({
      connectScope: getRequiredConnectScope(request),
      fields: payload,
      userId: request.user.id,
    })

    return { data: toAgentDto({ agent, agentSettings }) }
  }

  @Get(AgentsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof AgentsRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(request)
    const agents = await this.agentsService.listAgents({
      userId: request.user.id,
      connectScope,
    })
    const results = await Promise.all(
      agents.map(async (agent) => {
        const agentSettings = await this.agentSettingsService.getLast({
          connectScope,
          agentId: agent.id,
        })
        return toAgentDto({ agent, agentSettings })
      }),
    )
    return { data: results }
  }

  @Patch(AgentsRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  async updateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentsRoutes.updateOne.request,
  ): Promise<typeof AgentsRoutes.updateOne.response> {
    const agentId = request.agent.id

    const agent = await this.agentsService.updateAgent({
      connectScope: getRequiredConnectScope(request),
      agentId,
      fieldsToUpdate: payload,
    })

    if (!agent) {
      throw new Error("Agent not updated")
    }
    return { data: { success: true } }
  }

  //fixme DOO ajouter getAll history
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

function toAgentDto({
  agent,
  agentSettings,
}: {
  agent: Agent
  agentSettings: AgentSettings
}): AgentDto {
  return {
    createdAt: agent.createdAt.getTime(),
    greetingMessage: agentSettings.greetingMessage ?? undefined,
    instructions: agentSettings.instructions,
    hasCategories: (agent.sessionCategories?.length ?? 0) > 0,
    id: agent.id,
    locale: agentSettings.locale,
    model: agentSettings.model,
    name: agent.name,
    outputJsonSchema: (agentSettings.outputJsonSchema as AgentDto["outputJsonSchema"]) ?? undefined,
    projectId: agent.projectId,
    temperature: Number(agentSettings.temperature),
    type: agent.type,
    updatedAt: agentSettings.updatedAt.getTime(),
    documentTagIds: agent.documentTags?.map((tag) => tag.id) || [],
    resourceLibraryIds: agent.resourceLibraries?.map((library) => library.id) || [],
    documentsRagMode: agentSettings.documentsRagMode,
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
  }
}

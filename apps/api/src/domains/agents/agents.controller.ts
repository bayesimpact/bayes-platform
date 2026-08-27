import {
  type AgentSubAgentDto,
  AgentSubAgentsRoutes,
  AgentsRoutes,
  createAgentSchema,
  replaceAgentSubAgentsSchema,
  updateAgentNameSchema,
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
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { AgentGuard } from "./agent.guard"
import { toAgentDto, toAgentWithDraftDto } from "./agent.mapper"
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

  @Get(AgentsRoutes.getAllWithDrafts.path)
  @CheckPolicy((policy) => policy.canList())
  async getAllWithDrafts(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof AgentsRoutes.getAllWithDrafts.response> {
    const connectScope = getRequiredConnectScope(request)
    const agents = await this.agentsService.listAgents({
      userId: request.user.id,
      connectScope,
    })
    const results = await Promise.all(
      agents.map(async (agent) => {
        const currentAgentSettings = await this.agentSettingsService.getLast({
          connectScope,
          agentId: agent.id,
        })

        const draftAgentSettings = await this.agentSettingsService.getLast({
          connectScope,
          agentId: agent.id,
          includesDraft: true,
        })

        const hasDraft =
          draftAgentSettings.isDraft && currentAgentSettings.id !== draftAgentSettings.id
        if (hasDraft)
          return toAgentWithDraftDto({ agent, currentAgentSettings, draftAgentSettings })
        else return toAgentWithDraftDto({ agent, currentAgentSettings })
      }),
    )
    return { data: results }
  }

  // NOTE: update agent name only
  @Patch(AgentsRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(updateAgentNameSchema))
  async updateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload: { name } }: typeof AgentsRoutes.updateOne.request,
  ): Promise<typeof AgentsRoutes.updateOne.response> {
    const agentId = request.agent.id
    const connectScope = getRequiredConnectScope(request)

    const isUpdated = await this.agentsService.updateAgentName({ connectScope, agentId, name })

    if (!isUpdated) {
      throw new Error("Agent not updated")
    }
    return { data: { success: true } }
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

  //
  // Sub-agents endpoints
  //
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
}

function toAgentSubAgentDto(entity: AgentSubAgent): AgentSubAgentDto {
  return {
    id: entity.id,
    parentAgentId: entity.parentAgentId,
    childAgentId: entity.childAgentId,
    toolName: entity.toolName,
    description: entity.description,
    enabled: entity.enabled,
    mode: entity.mode,
    nextChildAgentId: entity.nextChildAgentId,
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

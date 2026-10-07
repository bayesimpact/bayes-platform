import {
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
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_CREATE_PERMISSION,
  AGENT_DELETE_PERMISSION,
  AGENT_DRAFT_READ_PERMISSION,
  AGENT_SUB_AGENT_READ_PERMISSION,
  AGENT_SUB_AGENT_UPDATE_PERMISSION,
  AGENT_UPDATE_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { toAgentDto, toAgentSubAgentDto, toAgentWithDraftDto } from "./agent.mapper"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "./agents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSubAgentsService } from "./sub-agents/agent-sub-agents.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly agentSubAgentsService: AgentSubAgentsService,
  ) {}

  @Post(AgentsRoutes.createOne.path)
  @CheckPermission(AGENT_CREATE_PERMISSION, "project")
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
  @CheckPermission(PROJECT_READ_PERMISSION, "project")
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
  @CheckPermission(AGENT_DRAFT_READ_PERMISSION, "project")
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
  @CheckPermission(AGENT_UPDATE_PERMISSION, "agent")
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
  @CheckPermission(AGENT_DELETE_PERMISSION, "agent")
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
  @CheckPermission(AGENT_SUB_AGENT_READ_PERMISSION, "agent")
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
  @CheckPermission(AGENT_SUB_AGENT_UPDATE_PERMISSION, "agent")
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

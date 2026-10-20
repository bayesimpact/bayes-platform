import {
  type AgentModelDto,
  type AgentModelListDto,
  AgentSubAgentsRoutes,
  AgentsRoutes,
  createAgentSchema,
  duplicateAgentSchema,
  replaceAgentSubAgentsSchema,
  updateAgentNameSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import type { AgentModelData } from "@/domains/agents/settings/agent-models.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  AGENT_CREATE_PERMISSION,
  AGENT_DELETE_PERMISSION,
  AGENT_DRAFT_READ_PERMISSION,
  AGENT_DUPLICATE_PERMISSION,
  AGENT_SUB_AGENT_READ_PERMISSION,
  AGENT_SUB_AGENT_UPDATE_PERMISSION,
  AGENT_UPDATE_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { toAgentDto, toAgentSubAgentDto, toAgentWithDraftDto } from "./agent.mapper"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentDuplicationService } from "./agent-duplication.service"
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
    private readonly agentDuplicationService: AgentDuplicationService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly agentSubAgentsService: AgentSubAgentsService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post(AgentsRoutes.createOne.path)
  @CheckPermission(AGENT_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "agent.create" })
  @UsePipes(new ZodValidationPipe(createAgentSchema))
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof AgentsRoutes.createOne.request,
  ): Promise<typeof AgentsRoutes.createOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { agent, agentSettings } = await this.agentsService.createAgent({
      connectScope,
      fields: {
        ...payload,
        providerOptions: await this.agentSettingsService.resolveNewAgentModelOptions({
          connectScope,
          model: payload.model,
          providerOptions: payload.providerOptions,
        }),
      },
      userId: request.user.id,
    })

    return { data: toAgentDto({ agent, agentSettings }) }
  }

  /**
   * Copies the agent into a new agent of the project: its published settings, tools, sub-agents
   * and sources, under a new name. The copy's settings are a draft for its owner to publish.
   */
  @Post(AgentsRoutes.duplicateOne.path)
  @CheckPermission(AGENT_DUPLICATE_PERMISSION, "agent")
  @AddContext("agent")
  @TrackActivity({ action: "agent.duplicate", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(duplicateAgentSchema))
  async duplicateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload: { name } }: typeof AgentsRoutes.duplicateOne.request,
  ): Promise<typeof AgentsRoutes.duplicateOne.response> {
    const connectScope = getRequiredConnectScope(request)
    // The copy is a new agent of the project: holding agent.duplicate on the original is not enough.
    const canCreateAgents = await this.permissionService.has(
      request.user.id,
      AGENT_CREATE_PERMISSION,
      { type: "project", id: connectScope.projectId },
    )
    if (!canCreateAgents) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    const { agent, agentSettings } = await this.agentDuplicationService.duplicateAgent({
      connectScope,
      agentId: request.agent.id,
      name,
      userId: request.user.id,
    })
    return { data: toAgentWithDraftDto({ agent, draftAgentSettings: agentSettings }) }
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
        const agentSettings = await this.agentSettingsService.findLastPublished({
          connectScope,
          agentId: agent.id,
        })
        return agentSettings ? [toAgentDto({ agent, agentSettings })] : []
      }),
    )
    // An agent that was never published, such as a fresh copy, cannot be used yet.
    return { data: results.flat() }
  }

  @Get(AgentsRoutes.getAvailableModels.path)
  @CheckPermission(PROJECT_READ_PERMISSION, "project")
  async getAvailableModels(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof AgentsRoutes.getAvailableModels.response> {
    const availableModels = await this.agentSettingsService.getAvailableModels(
      getRequiredConnectScope(request),
    )
    return {
      data: {
        models: availableModels.models.map((model) => toAgentModelDto(model)),
        defaults: availableModels.defaults,
      } satisfies AgentModelListDto,
    }
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
        const currentAgentSettings = await this.agentSettingsService.findLastPublished({
          connectScope,
          agentId: agent.id,
        })

        const draftAgentSettings = await this.agentSettingsService.getLast({
          connectScope,
          agentId: agent.id,
          includesDraft: true,
        })

        const hasDraft =
          draftAgentSettings.isDraft && currentAgentSettings?.id !== draftAgentSettings.id
        return toAgentWithDraftDto({
          agent,
          currentAgentSettings,
          draftAgentSettings: hasDraft ? draftAgentSettings : undefined,
        })
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

function toAgentModelDto(model: AgentModelData): AgentModelDto {
  return {
    model: model.agentModel,
    provider: model.agentProvider,
    isAvailable: model.isAvailable,
    deprecation: model.agentModelDeprecation,
    servedOutsideEu: model.servedOutsideEu,
    optionsSchema: model.optionsSchema,
    defaultOptions: model.defaultOptions,
  }
}

import {
  type AgentModelsOutputDto,
  type AgentVersionOutputDto,
  EvalAgentsRoutes,
  type ProjectAgentOutputDto,
} from "@bayes-platform/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "@/domains/agents/agents.service"
import type { AvailableModels } from "@/domains/agents/settings/agent-models.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import {
  AGENT_SETTINGS_READ_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"

type Agent = Awaited<ReturnType<AgentsService["listAgents"]>>["agents"][number]
type AgentVersion = Awaited<ReturnType<AgentSettingsService["getAll"]>>[number]

/** The agents of a project that an evaluation runs, their versions, and the models it judges with. */
@Controller()
export class EvalAgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  /** A copy of `AgentsController.getAll`: the agents with a version in production. */
  @SchemaRoute(EvalAgentsRoutes.getAllOfProject, {
    permission: { key: PROJECT_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAllOfProject(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalAgentsRoutes.getAllOfProject>> {
    const connectScope = getRequiredConnectScope(request)
    const { agents } = await this.agentsService.listAgents({
      userId: request.user.id,
      connectScope,
    })
    const results = await Promise.all(
      agents.map(async (agent) => {
        const agentSettings = await this.agentSettingsService.findProduction({
          connectScope,
          agentId: agent.id,
        })
        return agentSettings ? [toProjectAgentDto(agent)] : []
      }),
    )
    // An agent that was never published, such as a fresh copy, cannot be run yet.
    return { data: results.flat() }
  }

  /** A copy of `AgentSettingsController.getAllWithDraft`: the history, the draft included. */
  @SchemaRoute(EvalAgentsRoutes.getVersions, {
    permission: { key: AGENT_SETTINGS_READ_PERMISSION, on: "agent" },
    context: ["organization", "project", "agent"],
  })
  async getVersions(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof EvalAgentsRoutes.getVersions>> {
    const versions = await this.agentSettingsService.getAll({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      includesDraft: true,
    })
    return { data: versions.map(toAgentVersionDto) }
  }

  /** A copy of `AgentsController.getAvailableModels`. */
  @SchemaRoute(EvalAgentsRoutes.getModels, {
    permission: { key: PROJECT_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getModels(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalAgentsRoutes.getModels>> {
    const availableModels = await this.agentSettingsService.getAvailableModels(
      getRequiredConnectScope(request),
    )
    return { data: toAgentModelsDto(availableModels) }
  }
}

function toProjectAgentDto(agent: Agent): ProjectAgentOutputDto {
  return { id: agent.id, name: agent.name, type: agent.type, projectId: agent.projectId }
}

function toAgentVersionDto(version: AgentVersion): AgentVersionOutputDto {
  return {
    id: version.id,
    revision: version.revision,
    name: version.revisionName ?? null,
    description: version.revisionDesc ?? null,
    isDraft: version.isDraft,
    isProduction: version.isProduction,
    updatedAt: version.updatedAt.getTime(),
    instructions: version.instructions,
    greetingMessage: version.greetingMessage ?? undefined,
    model: version.model,
    providerOptions: version.providerOptions,
    documentsRagMode: version.documentsRagMode,
    outputJsonSchema: version.outputJsonSchema ?? undefined,
    fillFormEnabled: version.fillFormEnabled,
    priorityCallsEnabled: version.priorityCallsEnabled,
    variables: version.variables,
    embeddingModel: version.embeddingModel,
    followUpSuggestionsEnabled: version.followUpSuggestionsEnabled,
    followUpSuggestionsInstructions: version.followUpSuggestionsInstructions,
    followUpSuggestionsMax: version.followUpSuggestionsMax,
  }
}

function toAgentModelsDto(availableModels: AvailableModels): AgentModelsOutputDto {
  return {
    models: availableModels.models.map((model) => ({
      model: model.agentModel,
      isAvailable: model.isAvailable,
      // The app reads only whether a model is retired: the contract keeps no detail of it.
      deprecation: model.agentModelDeprecation ? {} : null,
      servedOutsideEu: model.servedOutsideEu,
    })),
    defaults: { judge: availableModels.defaults.judge },
  }
}

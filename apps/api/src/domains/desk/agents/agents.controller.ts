import { DeskAgentsRoutes } from "@bayes-platform/desk-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
import { toAgentDto } from "@/domains/agents/agent.mapper"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "@/domains/agents/agents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { PROJECT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"

/** The agents of a project that the signed-in person can use. */
@Controller()
export class DeskAgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @SchemaRoute(DeskAgentsRoutes.getAllOfProject, {
    permission: { key: PROJECT_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAllOfProject(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof DeskAgentsRoutes.getAllOfProject>> {
    const connectScope = getRequiredConnectScope(request)
    const { agents, permissionsByAgentId } = await this.agentsService.listAgents({
      userId: request.user.id,
      connectScope,
    })
    const results = await Promise.all(
      agents.map(async (agent) => {
        const agentSettings = await this.agentSettingsService.findProduction({
          connectScope,
          agentId: agent.id,
        })
        const permissions = permissionsByAgentId.get(agent.id) ?? []
        return agentSettings ? [toAgentDto({ agent, agentSettings, permissions })] : []
      }),
    )
    // An agent that was never published, such as a fresh copy, cannot be used yet.
    return { data: results.flat() }
  }
}

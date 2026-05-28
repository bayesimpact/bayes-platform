import type { RequestPayload, ResponseData } from "../../generic"
import { defineRoute } from "../../helpers"
import type { AgentSubAgentDto, ReplaceAgentSubAgentsDto } from "../agents.dto"

export const AgentSubAgentsRoutes = {
  getAll: defineRoute<ResponseData<AgentSubAgentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/sub-agents",
  }),
  updateAll: defineRoute<
    ResponseData<AgentSubAgentDto[]>,
    RequestPayload<ReplaceAgentSubAgentsDto>
  >({
    method: "put",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/sub-agents",
  }),
}

import type { ResponseData } from "../../generic"
import { defineRoute } from "../../helpers"
import type { AgentDto } from "../agents.dto"

export const AgentHistoryRoutes = {
  getAll: defineRoute<ResponseData<AgentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/history",
  }),
}

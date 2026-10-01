import type { ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AgentMembershipDto } from "./agent-membership.dto"

export const AgentMembershipRoutes = {
  getAll: defineRoute<ResponseData<AgentMembershipDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/memberships",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/memberships/:agentMembershipId",
  }),
}

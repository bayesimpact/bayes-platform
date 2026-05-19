import type { ProjectMemberAgentDto } from "../agent-membership/agent-membership.dto"
import type { ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { ProjectMembershipDto } from "./project-membership.dto"

export const ProjectMembershipRoutes = {
  getAll: defineRoute<ResponseData<ProjectMembershipDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/memberships",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/memberships/:membershipId",
  }),
  getMemberAgents: defineRoute<ResponseData<ProjectMemberAgentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/memberships/:membershipId/agents",
  }),
}

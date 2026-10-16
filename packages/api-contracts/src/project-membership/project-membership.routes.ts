import type { ProjectMemberAgentDto } from "../agent-membership/agent-membership.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  ProjectMembershipDto,
  UpdateProjectMembershipRequestDto,
} from "./project-membership.dto"

export const ProjectMembershipRoutes = {
  getAll: defineRoute<ResponseData<ProjectMembershipDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/memberships",
  }),
  /** Switches another member between admin and member. Needs `project.member.update`. */
  updateOne: defineRoute<
    ResponseData<ProjectMembershipDto>,
    RequestPayload<UpdateProjectMembershipRequestDto>
  >({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/memberships/:membershipId",
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

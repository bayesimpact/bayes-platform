import type { ProjectMemberAgentDto } from "../agent-membership/agent-membership.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AddProjectMemberRolesRequestDto,
  DeleteProjectMembersRequestDto,
  ProjectMembershipDto,
  ProjectRoleDto,
  UpdateProjectMembershipRequestDto,
} from "./project-membership.dto"

export const ProjectMembershipRoutes = {
  getAll: defineRoute<ResponseData<ProjectMembershipDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/users",
  }),
  /** Switches another member between admin and member. Needs `project.member.update`. */
  updateOne: defineRoute<
    ResponseData<ProjectMembershipDto>,
    RequestPayload<UpdateProjectMembershipRequestDto>
  >({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/users/:userId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/users/:userId",
  }),
  getMemberAgents: defineRoute<ResponseData<ProjectMemberAgentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/users/:userId/agents",
  }),
  /** The roles a member can be given on the workspace, in catalog order. Needs `project.member.read`. */
  getAssignableRoles: defineRoute<ResponseData<ProjectRoleDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/roles",
  }),
  /**
   * Gives roles to several members, all or nothing, and returns them. Needs `project.member.update`.
   * Nobody changes their own roles. `project_owner` and `project_admin` also make them admin of
   * every agent of the workspace.
   */
  addRoles: defineRoute<
    ResponseData<ProjectMembershipDto[]>,
    RequestPayload<AddProjectMemberRolesRequestDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/users/roles",
  }),
  /**
   * Takes one role from a member and returns them. Needs `project.member.update`. Nobody changes
   * their own roles, a member keeps at least one role, and the workspace its last owner.
   */
  removeRole: defineRoute<ResponseData<ProjectMembershipDto>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/users/:userId/roles/:roleKey",
  }),
  /**
   * Removes several members, all or nothing, like `deleteOne` for each. Needs
   * `project.member.delete`. Nobody removes themselves, and the workspace keeps an owner.
   */
  deleteMany: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<DeleteProjectMembersRequestDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/users/delete",
  }),
}

import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AddProjectMemberRolesRequestDto,
  AssignableRolesDto,
  DeleteProjectMembersRequestDto,
  ProjectMemberRolesDto,
  ProjectMembershipDto,
} from "./project-membership.dto"

export const ProjectMembershipRoutes = {
  getAll: defineRoute<ResponseData<ProjectMembershipDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/users",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/users/:userId",
  }),
  /**
   * The member's roles on the workspace, its agents and its review campaigns, and the permissions
   * they grant. Needs `project.member.read`.
   */
  getMemberRoles: defineRoute<ResponseData<ProjectMemberRolesDto>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/users/:userId/roles",
  }),
  /**
   * The roles a member can be given on the workspace, an agent and a review campaign, in catalog
   * order. Needs `project.member.read`.
   */
  getAssignableRoles: defineRoute<ResponseData<AssignableRolesDto>>({
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

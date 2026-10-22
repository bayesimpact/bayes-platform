import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AddMemberRoleRequestDto } from "../project-membership/project-membership.dto"
import type {
  AddAgentMemberRolesRequestDto,
  AgentMembershipDto,
  DeleteAgentMembersRequestDto,
} from "./agent-membership.dto"

export const AgentMembershipRoutes = {
  getAll: defineRoute<ResponseData<AgentMembershipDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/:userId",
  }),
  /**
   * Gives the admin or member role on the agent to several members, all or nothing. Needs
   * `agent.member.update`. Nobody changes their own roles.
   */
  addRoles: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<AddAgentMemberRolesRequestDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/roles",
  }),
  /**
   * Removes several members from the agent, all or nothing. Needs `agent.member.delete`. Nobody
   * removes themselves, and an owner stays.
   */
  deleteMany: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<DeleteAgentMembersRequestDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/delete",
  }),
  /**
   * Gives a member of the workspace the admin or member role on the agent. Needs
   * `agent.member.update`. Nobody changes their own roles.
   */
  addRole: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<AddMemberRoleRequestDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/:userId/roles",
  }),
  /**
   * Takes the admin or member role from a member on the agent. Needs `agent.member.update`. Nobody
   * changes their own roles.
   */
  removeRole: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/:userId/roles/:roleKey",
  }),
}

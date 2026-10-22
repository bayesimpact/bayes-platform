import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AddMemberRoleRequestDto } from "../project-membership/project-membership.dto"
import type { AgentMembershipDto } from "./agent-membership.dto"

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
   * Gives a member of the workspace a role on the agent. Needs `agent.member.update`. Nobody
   * changes their own roles.
   */
  addRole: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<AddMemberRoleRequestDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/:userId/roles",
  }),
  /**
   * Takes a role from a member on the agent. Needs `agent.member.update`. Nobody changes their own
   * roles, and the agent keeps an owner.
   */
  removeRole: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/users/:userId/roles/:roleKey",
  }),
}

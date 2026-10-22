import { z } from "zod"
import type { TimeType } from "../generic"
import { memberUserIdsSchema } from "../project-membership/project-membership.dto"
import type { MembershipRoleDto } from "../rbac/membership-role.dto"

/**
 * A person with access to an agent, with every role they hold on it. A member is identified by
 * the agent and `userId`; each role carries the id of the row that holds it.
 */
export type AgentMembershipDto = {
  agentId: string
  userId: string
  userName: string
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  roles: MembershipRoleDto[]
  createdAt: TimeType
}

/** Gives the agent roles to every member listed. All or nothing: one refusal changes nobody. */
export const addAgentMemberRolesSchema = z.object({
  userIds: memberUserIdsSchema,
  roleKeys: z.array(z.string().min(1)).min(1).max(3),
})
export type AddAgentMemberRolesRequestDto = z.infer<typeof addAgentMemberRolesSchema>

/** Removes every member listed from the agent. All or nothing: one refusal removes nobody. */
export const deleteAgentMembersSchema = z.object({
  userIds: memberUserIdsSchema,
})
export type DeleteAgentMembersRequestDto = z.infer<typeof deleteAgentMembersSchema>

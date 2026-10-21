import type { AgentType } from "../agents/agents.dto"
import type { TimeType } from "../generic"
import type { MembershipRoleDto } from "../rbac/membership-role.dto"

/**
 * A person with access to an agent, with every role they hold on it. `id` is the oldest of their
 * membership rows on the agent, and the routes accept any of them.
 */
export type AgentMembershipDto = {
  id: string
  agentId: string
  userId: string
  userName: string
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  roles: MembershipRoleDto[]
  createdAt: TimeType
}

export type ProjectMemberAgentDto = {
  agentId: string
  agentName: string
  agentType: AgentType
  membershipId: string | null
  /** The member's roles on the agent, empty without a membership. */
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant on the agent, together. */
  permissions: string[]
}

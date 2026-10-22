import type { AgentType } from "../agents/agents.dto"
import type { TimeType } from "../generic"
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

export type ProjectMemberAgentDto = {
  agentId: string
  agentName: string
  agentType: AgentType
  /** The member's roles on the agent, empty without a membership. */
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant on the agent, together. */
  permissions: string[]
}

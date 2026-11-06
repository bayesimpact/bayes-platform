import type { Agent } from "@/domains/agents/agent.entity"
import type { AGENT_CONVERSATION_REVIEWER_ROLE, AGENT_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"

/** An `agent_*` catalog role key (`AGENT_ROLES`, or the conversation reviewer role). */
export type AgentRoleKey =
  | (typeof AGENT_ROLES)[keyof typeof AGENT_ROLES]
  | typeof AGENT_CONVERSATION_REVIEWER_ROLE

/** Plain-object shape used by test factories before persistence. */
export type AgentMembershipFixture = {
  id: string
  userId: string
  agentId: string
  /** One `role_grant` row per role key. */
  roleKeys: AgentRoleKey[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  agent: Agent
}

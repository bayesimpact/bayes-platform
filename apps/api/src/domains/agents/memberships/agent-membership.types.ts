import type { Agent } from "@/domains/agents/agent.entity"
import type { User } from "@/domains/users/user.entity"

/** Shorthand for the `agent_*` catalog roles (`AGENT_ROLES`), used by test fixtures. */
export type AgentMembershipRole = "owner" | "admin" | "member"

/** Plain-object shape used by test factories before persistence. */
export type AgentMembershipFixture = {
  id: string
  userId: string
  agentId: string
  role: AgentMembershipRole
  roleId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  agent: Agent
}

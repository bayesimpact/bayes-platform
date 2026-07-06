import type { Agent } from "@/domains/agents/agent.entity"
import type { User } from "@/domains/users/user.entity"
import type { AgentMembershipRole } from "./agent-membership.entity"

/**
 * Domain model for an agent membership.
 *
 * Plain object returned to the service layer. The `agent` attribute is a
 * TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once Agent is also split.
 */
export type AgentMembershipModel = {
  id: string
  userId: string
  agentId: string
  role: AgentMembershipRole
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  agent: Agent
}

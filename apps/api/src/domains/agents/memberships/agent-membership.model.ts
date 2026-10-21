import type { Agent } from "@/domains/agents/agent.entity"
import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { User } from "@/domains/users/user.entity"

/**
 * Domain model for a person's membership in an agent: every role they hold on it, one
 * `user_membership` row each (owner, admin or member, and `agent_conversation_reviewer`).
 *
 * Plain object returned to the service layer. `id` is the oldest row's id. The `agent` attribute
 * is a TypeORM entity for now (pragmatic compromise during the transition away from legacy
 * tables); it will become a domain model once Agent is also split.
 */
export type AgentMembershipModel = {
  id: string
  userId: string
  agentId: string
  roles: MembershipRole[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  agent: Agent
}

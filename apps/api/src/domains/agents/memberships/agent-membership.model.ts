import type { Agent } from "@/domains/agents/agent.entity"
import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { User } from "@/domains/users/user.entity"

/**
 * Domain model for a person's membership in an agent: every role they hold on it, one
 * `role_grant` row each (owner, admin or member, and `agent_conversation_reviewer`).
 *
 * Plain object returned to the service layer. The person and the agent identify it; each role
 * carries the id of its row. The studio views keep the member roles only
 * (`AgentMembershipsService`). The `agent` attribute is a TypeORM entity for now (pragmatic
 * compromise during the transition away from legacy tables); it will become a domain model once
 * Agent is also split.
 */
export type AgentMembershipModel = {
  userId: string
  agentId: string
  roles: MembershipRole[]
  /** When the person got their first role on the agent. */
  createdAt: Date
  updatedAt: Date
  user: User
  agent: Agent
}

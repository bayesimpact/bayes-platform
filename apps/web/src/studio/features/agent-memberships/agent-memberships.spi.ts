import type { AgentMembership } from "./agent-memberships.models"

type AgentScope = { organizationId: string; projectId: string; agentId: string }

export interface IAgentMembershipsSpi {
  getAll: (params: AgentScope) => Promise<AgentMembership[]>
  /** All or nothing. */
  addRoles: (params: AgentScope & { memberUserIds: string[]; roleKeys: string[] }) => Promise<void>
  /** All or nothing. */
  removeMany: (params: AgentScope & { memberUserIds: string[] }) => Promise<void>
}

import type { AgentType } from "../agents/agents.dto"
import type { TimeType } from "../generic"

export type AgentMembershipRoleDto = "owner" | "admin" | "member"

export type AgentMembershipDto = {
  id: string
  agentId: string
  userId: string
  userName: string
  userEmail: string
  role: AgentMembershipRoleDto
  createdAt: TimeType
}

export type ProjectMemberAgentDto = {
  agentId: string
  agentName: string
  agentType: AgentType
  membershipId: string | null
  role: AgentMembershipRoleDto | null
}

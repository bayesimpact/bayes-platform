import type {
  AgentMembershipRoleDto,
  AgentType,
  ProjectMembershipRoleDto,
  TimeType,
} from "@caseai-connect/api-contracts"

export type ProjectMembership = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  createdAt: TimeType
  role: ProjectMembershipRoleDto
}

export type ProjectMemberAgent = {
  agentId: string
  agentName: string
  agentType: AgentType
  membershipId: string | null
  role: AgentMembershipRoleDto | null
}

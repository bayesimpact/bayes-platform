import type { AgentMembershipRoleDto, TimeType } from "@caseai-connect/api-contracts"

export type AgentMembership = {
  id: string
  agentId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  role: AgentMembershipRoleDto
}

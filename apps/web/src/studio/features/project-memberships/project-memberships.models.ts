import type { AgentType, TimeType } from "@caseai-connect/api-contracts"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"

export type ProjectMembership = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  /** The highest of the member's project roles, until this screen shows them all (#1076). */
  role: LegacyMembershipRole
  /** Permission keys the roles grant on the project. */
  permissions: string[]
}

export type ProjectMemberAgent = {
  agentId: string
  agentName: string
  agentType: AgentType
  membershipId: string | null
  /** The highest of the member's agent roles, until this screen shows them all (#1077). */
  role: LegacyMembershipRole | null
  /** Permission keys the roles grant on the agent, empty without a membership. */
  permissions: string[]
}

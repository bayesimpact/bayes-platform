import type { TimeType } from "@caseai-connect/api-contracts"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"

export type AgentMembership = {
  agentId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  /** The highest of the member's agent roles, until this screen shows them all. */
  role: LegacyMembershipRole
}

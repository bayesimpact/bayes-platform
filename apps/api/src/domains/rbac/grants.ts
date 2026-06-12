/**
 * Structural grant types — replace the legacy `*Membership` entity classes
 * everywhere that consumed them only as a typed shape (`{ userId, scope ids, role }`).
 * The authoritative storage is `user_role`; these types are computed projections
 * built by context resolvers and consumed by policies / guards.
 */

export type ScopedMembershipRole = "owner" | "admin" | "member"
export type CampaignMembershipRole = "tester" | "reviewer"

/** Aliases retained so spec files that previously imported from the legacy entity files can swap paths without renaming. */
export type OrganizationMembershipRole = ScopedMembershipRole
export type ProjectMembershipRole = ScopedMembershipRole
export type AgentMembershipRole = ScopedMembershipRole

export type OrganizationGrant = {
  id?: string
  userId: string
  organizationId: string
  role: ScopedMembershipRole
}

export type ProjectGrant = {
  id?: string
  userId: string
  organizationId: string
  projectId: string
  role: ScopedMembershipRole
}

export type AgentGrant = {
  id?: string
  userId: string
  organizationId: string
  projectId: string
  agentId: string
  role: ScopedMembershipRole
}

export type CampaignGrant = {
  id?: string
  userId: string
  organizationId: string
  projectId: string
  campaignId: string
  role: CampaignMembershipRole
}

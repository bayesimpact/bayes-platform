import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"
import type { OrganizationMembershipRole } from "./organization-membership.types"

/** Fields loaded by context resolvers and policies (no relation hydration). */
export type OrganizationMembershipContextModel = {
  id: string
  userId: string
  organizationId: string
  role: OrganizationMembershipRole
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/**
 * Domain model for an organization membership.
 *
 * Plain object returned to the service layer. The `organization` attribute is a
 * TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once Organization is also split.
 */
export type OrganizationMembershipModel = OrganizationMembershipContextModel & {
  user: User
  organization: Organization
}

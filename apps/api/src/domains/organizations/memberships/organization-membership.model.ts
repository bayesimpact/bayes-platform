import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"

/** Fields loaded by context resolvers (no relation hydration). */
export type OrganizationMembershipContextModel = {
  /** The oldest of the person's rows on the organization. */
  id: string
  userId: string
  organizationId: string
  /** Every role the person holds on the organization, one `user_membership` row each. */
  roles: MembershipRole[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/**
 * Domain model for a person's membership in an organization.
 *
 * Plain object returned to the service layer. The `organization` attribute is a
 * TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once Organization is also split.
 */
export type OrganizationMembershipModel = OrganizationMembershipContextModel & {
  user: User
  organization: Organization
}

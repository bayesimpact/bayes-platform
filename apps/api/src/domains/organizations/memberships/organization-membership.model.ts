import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"

/**
 * What `OrganizationContextResolver` puts on the request for the caller: who they are on the
 * organization and the roles they hold there. No row id or dates: a person can hold several
 * `user_membership` rows on one organization (one per role), and nothing reads them here.
 */
export type OrganizationMembershipContextModel = {
  userId: string
  organizationId: string
  /** Every role the person holds on the organization, one `user_membership` row each. */
  roles: MembershipRole[]
}

/**
 * Domain model for a person's membership in an organization.
 *
 * Plain object returned to the service layer. The `organization` attribute is a
 * TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once Organization is also split.
 */
export type OrganizationMembershipModel = OrganizationMembershipContextModel & {
  /** The oldest of the person's rows on the organization. */
  id: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  organization: Organization
}

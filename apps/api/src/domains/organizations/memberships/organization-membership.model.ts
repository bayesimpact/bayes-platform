import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"

/**
 * What `OrganizationContextResolver` puts on the request for the caller: who they are on the
 * organization and the roles they hold there. No row id or dates: a person can hold several
 * `role_grant` rows on one organization (one per role), and nothing reads them here.
 */
export type OrganizationMembershipContextModel = {
  userId: string
  organizationId: string
  /** Every role the person holds on the organization, one `role_grant` row each. */
  roles: MembershipRole[]
}

/**
 * Domain model for a person's membership in an organization.
 *
 * Plain object returned to the service layer. The person and the organization identify it;
 * each role carries the id of its row. The `organization` attribute is a
 * TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once Organization is also split.
 */
export type OrganizationMembershipModel = OrganizationMembershipContextModel & {
  /** When the person got their first role on the organization. */
  createdAt: Date
  updatedAt: Date
  user: User
  organization: Organization
}

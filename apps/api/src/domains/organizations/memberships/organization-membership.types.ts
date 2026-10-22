import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"

/** Shorthand for the `org_*` catalog roles (`ORGANIZATION_ROLES`), used by test fixtures. */
export type OrganizationMembershipRole = "owner" | "admin" | "member"

/** Plain-object shape used by test factories before persistence. */
export type OrganizationMembershipFixture = {
  id: string
  userId: string
  organizationId: string
  role: OrganizationMembershipRole
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  organization: Organization
}

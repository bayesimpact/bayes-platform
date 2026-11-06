import type { Organization } from "@/domains/organizations/organization.entity"
import type { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"

/** An `org_*` catalog role key (`ORGANIZATION_ROLES`). */
export type OrganizationRoleKey = (typeof ORGANIZATION_ROLES)[keyof typeof ORGANIZATION_ROLES]

/** Plain-object shape used by test factories before persistence. */
export type OrganizationMembershipFixture = {
  id: string
  userId: string
  organizationId: string
  /** One `role_grant` row per role key. */
  roleKeys: OrganizationRoleKey[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  organization: Organization
}

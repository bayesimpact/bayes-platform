/** The kind of resource a catalog role is held on. */
export type RoleScopeTypeDto = "organization" | "project" | "agent" | "review_campaign" | "global"

/**
 * One role a person holds on a resource, read from `user_membership.role_id`. A person can hold
 * several roles on one resource, one membership row each.
 */
export type MembershipRoleDto = {
  /** The membership row that holds this role. */
  membershipId: string
  key: string
  name: string
  scopeType: RoleScopeTypeDto
}

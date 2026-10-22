import type { MembershipRoleDto } from "@caseai-connect/api-contracts"

/** The owner / admin / member shorthand the studio screens still use for a single role. */
export type LegacyMembershipRole = "owner" | "admin" | "member"

const LEGACY_ROLES: LegacyMembershipRole[] = ["owner", "admin", "member"]

/** Whether one of the roles has one of the catalog keys. */
export function holdsRole(roles: MembershipRoleDto[], ...roleKeys: string[]): boolean {
  return roles.some((role) => roleKeys.includes(role.key))
}

/**
 * The highest of owner, admin and member among the roles (`project_admin` reads `admin`), for
 * the screens that show one role per member until they show every role (#1076, #1077).
 */
export function toLegacyRole(roles: MembershipRoleDto[]): LegacyMembershipRole | null {
  return (
    LEGACY_ROLES.find((legacyRole) => roles.some((role) => role.key.endsWith(`_${legacyRole}`))) ??
    null
  )
}

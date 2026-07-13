export type RoleScopeType = "organization" | "project" | "agent" | "global"

export const ORGANIZATION_ROLES = {
  owner: "org_owner",
  admin: "org_admin",
  member: "org_member",
} as const

export const ORGANIZATION_PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.delete",
] as const

/** Permissions granted per org role key. */
export const ORGANIZATION_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  org_owner: ORGANIZATION_PERMISSIONS,
  org_admin: ["organization.read", "organization.update"],
  org_member: ["organization.read"],
}

export type RoleScopeType = "organization" | "project" | "agent" | "global"

export const ORGANIZATION_ROLES = {
  owner: "org_owner",
  admin: "org_admin",
  member: "org_member",
} as const

export const ORG_CREATOR_ROLE = "org_creator" as const

export const ORGANIZATION_CREATE_PERMISSION = "organization.create" as const

export const ORGANIZATION_PERMISSIONS = [
  ORGANIZATION_CREATE_PERMISSION,
  "organization.read",
  "organization.update",
  "organization.delete",
] as const

/** Permissions granted per org role key. */
export const ORGANIZATION_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  org_owner: ["organization.read", "organization.update", "organization.delete"],
  org_admin: ["organization.read", "organization.update"],
  org_member: ["organization.read"],
  [ORG_CREATOR_ROLE]: [ORGANIZATION_CREATE_PERMISSION],
}

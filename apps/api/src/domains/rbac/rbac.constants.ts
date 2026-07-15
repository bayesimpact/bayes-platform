export type RoleScopeType = "organization" | "project" | "agent" | "global"

export const ORGANIZATION_ROLES = {
  owner: "org_owner",
  admin: "org_admin",
  member: "org_member",
} as const

export const ORG_CREATOR_ROLE = "org_creator" as const

export const ORGANIZATION_CREATE_PERMISSION = "organization.create" as const

export const PROJECT_CREATE_PERMISSION = "project.create" as const

export const PROJECT_LIST_ALL_PERMISSION = "project.list_all" as const

export const ORGANIZATION_PERMISSIONS = [
  ORGANIZATION_CREATE_PERMISSION,
  "organization.read",
  "organization.update",
  "organization.delete",
  PROJECT_CREATE_PERMISSION,
  PROJECT_LIST_ALL_PERMISSION,
] as const

/** Permissions granted per org role key. */
export const ORGANIZATION_ROLE_PERMISSIONS = {
  org_owner: [
    "organization.read",
    "organization.update",
    "organization.delete",
    PROJECT_CREATE_PERMISSION,
    PROJECT_LIST_ALL_PERMISSION,
  ],
  org_admin: [
    "organization.read",
    "organization.update",
    PROJECT_CREATE_PERMISSION,
    PROJECT_LIST_ALL_PERMISSION,
  ],
  org_member: ["organization.read"],
  [ORG_CREATOR_ROLE]: [ORGANIZATION_CREATE_PERMISSION],
} as const satisfies Record<string, readonly string[]>

import type { PermissionResourceType } from "./permission.types"

export type RoleScopeType = "organization" | "project" | "agent" | "global"

export const ORGANIZATION_ROLES = {
  owner: "org_owner",
  admin: "org_admin",
  member: "org_member",
} as const

export const ORG_CREATOR_ROLE = "org_creator" as const

export const PROJECT_ROLES = {
  owner: "project_owner",
  admin: "project_admin",
  member: "project_member",
} as const

export const ORGANIZATION_CREATE_PERMISSION = "organization.create" as const

export const PROJECT_CREATE_PERMISSION = "project.create" as const

export const PROJECT_READ_PERMISSION = "project.read" as const

export const ORGANIZATION_PERMISSIONS = [
  ORGANIZATION_CREATE_PERMISSION,
  "organization.read",
  "organization.update",
  "organization.delete",
  PROJECT_CREATE_PERMISSION,
  PROJECT_READ_PERMISSION,
] as const

/** Permissions granted per org role key. */
export const ORGANIZATION_ROLE_PERMISSIONS = {
  org_owner: [
    "organization.read",
    "organization.update",
    "organization.delete",
    PROJECT_CREATE_PERMISSION,
    PROJECT_READ_PERMISSION,
  ],
  org_admin: [
    "organization.read",
    "organization.update",
    PROJECT_CREATE_PERMISSION,
    PROJECT_READ_PERMISSION,
  ],
  org_member: ["organization.read"],
  [ORG_CREATOR_ROLE]: [ORGANIZATION_CREATE_PERMISSION],
} as const satisfies Record<string, readonly string[]>

/** Permissions granted per project role key. */
export const PROJECT_ROLE_PERMISSIONS = {
  project_owner: ["project.read", "project.update", "project.delete", "agent.create", "agent.read"],
  project_admin: ["project.read", "project.update", "project.delete", "agent.create", "agent.read"],
  project_member: ["project.read"],
} as const satisfies Record<string, readonly string[]>

export const RESOURCE_TYPE_READ_PERMISSION_MAP = {
  organization: "organization.read",
  project: "project.read",
  agent: "agent.read",
} as const satisfies Record<PermissionResourceType, string>

/**
 * Permissions that apply to a resource of a given type.
 * Used to filter the permissions inherited from a parent membership:
 * e.g. an org membership granting `project.read` cascades it to every
 * project of the org, but `organization.update` does not.
 */
export const RESOURCE_TYPE_PERMISSIONS_MAP = {
  organization: ["organization.read", "organization.update", "organization.delete"],
  project: [PROJECT_CREATE_PERMISSION, PROJECT_READ_PERMISSION],
  agent: ["agent.read"],
} as const satisfies Record<PermissionResourceType, readonly string[]>

export const PARENT_RESOURCE_TYPE_MAP = {
  organization: [],
  project: ["organization"],
  agent: ["organization", "project"],
} as const satisfies Record<PermissionResourceType, readonly PermissionResourceType[]>

import type { PermissionResourceType } from "./permission.types"

export type RoleScopeType = "organization" | "project" | "agent" | "global"

export const ORGANIZATION_ROLES = {
  owner: "org_owner",
  admin: "org_admin",
  member: "org_member",
} as const

export const PLATFORM_STAFF_ROLE = "platform_staff" as const

export const PLATFORM_SUPERADMIN_ROLE = "platform_superadmin" as const

export const PROJECT_ROLES = {
  owner: "project_owner",
  admin: "project_admin",
  member: "project_member",
} as const

export const AGENT_ROLES = {
  owner: "agent_owner",
  admin: "agent_admin",
  member: "agent_member",
} as const

export const ORGANIZATION_CREATE_PERMISSION = "organization.create" as const

export const TRACE_READ_PERMISSION = "trace.read" as const

export const BACKOFFICE_READ_PERMISSION = "backoffice.read" as const

/** Backoffice "list all" permissions: read every resource of a type on the platform. */
export const BACKOFFICE_ORGANIZATION_READ_PERMISSION = "backoffice.organization.read" as const

export const BACKOFFICE_PROJECT_READ_PERMISSION = "backoffice.project.read" as const

/** Mutate a project from the backoffice (e.g. feature flags). Not granted on org roles. */
export const BACKOFFICE_PROJECT_UPDATE_PERMISSION = "backoffice.project.update" as const

export const BACKOFFICE_AGENT_READ_PERMISSION = "backoffice.agent.read" as const

export const BACKOFFICE_USER_READ_PERMISSION = "backoffice.user.read" as const

export const BACKOFFICE_TERMS_UPDATE_PERMISSION = "backoffice.terms.update" as const

/** Install an App on a project. Global, same wiring as `backoffice.read`. */
export const APP_INSTALL_PERMISSION = "app.install" as const

/** AppManifest back-office CRUD. Superadmin only in V0; not granted by `app.install`. */
export const BACKOFFICE_APP_MANAGE_PERMISSION = "backoffice.app.manage" as const

export const DOCUMENT_READ_PERMISSION = "document.read" as const

export const DOCUMENT_CREATE_PERMISSION = "document.create" as const

export const DOCUMENT_UPDATE_PERMISSION = "document.update" as const

export const DOCUMENT_DELETE_PERMISSION = "document.delete" as const

export const PROJECT_CREATE_PERMISSION = "project.create" as const

export const PROJECT_READ_PERMISSION = "project.read" as const

export const PROJECT_UPDATE_PERMISSION = "project.update" as const

export const PROJECT_DELETE_PERMISSION = "project.delete" as const

/**
 * Permissions an App may be granted. Policy lives here, not in the database:
 * there is no Permission entity and no `app_grantable` column. Intersect this
 * list with `AppManifest.grantable_permissions` on save and on authorize.
 * Grouped by resource type (document, project/workspace, agent, …).
 */
export const APP_GRANTABLE_PERMISSIONS = [
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_UPDATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
] as const

export type AppGrantablePermission = (typeof APP_GRANTABLE_PERMISSIONS)[number]

const APP_GRANTABLE_PERMISSION_SET: ReadonlySet<string> = new Set(APP_GRANTABLE_PERMISSIONS)

function isAppGrantablePermission(permission: string): permission is AppGrantablePermission {
  return APP_GRANTABLE_PERMISSION_SET.has(permission)
}

/** Drop any permission that is not on the server-side App allowlist. */
export function intersectWithAppGrantablePermissions(
  permissions: readonly string[],
): AppGrantablePermission[] {
  const seen = new Set<AppGrantablePermission>()
  const granted: AppGrantablePermission[] = []
  for (const permission of permissions) {
    if (!isAppGrantablePermission(permission) || seen.has(permission)) continue
    seen.add(permission)
    granted.push(permission)
  }
  return granted
}

/** See the users who are members of a resource you hold this permission on. */
export const USER_READ_PERMISSION = "user.read" as const

export const ORGANIZATION_PERMISSIONS = [
  ORGANIZATION_CREATE_PERMISSION,
  "organization.read",
  "organization.update",
  "organization.delete",
  PROJECT_CREATE_PERMISSION,
  PROJECT_READ_PERMISSION,
] as const

/**
 * Permissions granted per org role key.
 * Org roles deliberately do NOT grant `project.read`: project visibility is
 * governed by project memberships only, so org owners/admins do not implicitly
 * see every project of the org.
 */
export const ORGANIZATION_ROLE_PERMISSIONS = {
  org_owner: [
    "organization.read",
    "organization.update",
    "organization.delete",
    PROJECT_CREATE_PERMISSION,
    USER_READ_PERMISSION,
    BACKOFFICE_ORGANIZATION_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  org_admin: [
    "organization.read",
    "organization.update",
    PROJECT_CREATE_PERMISSION,
    USER_READ_PERMISSION,
    BACKOFFICE_ORGANIZATION_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  org_member: ["organization.read"],
  // `backoffice.project.read` is global for staff so the App install picker
  // is not empty for the people who hold `app.install`.
  [PLATFORM_STAFF_ROLE]: [
    APP_INSTALL_PERMISSION,
    BACKOFFICE_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    TRACE_READ_PERMISSION,
  ],
  [PLATFORM_SUPERADMIN_ROLE]: [
    APP_INSTALL_PERMISSION,
    BACKOFFICE_APP_MANAGE_PERMISSION,
    BACKOFFICE_READ_PERMISSION,
    TRACE_READ_PERMISSION,
    BACKOFFICE_TERMS_UPDATE_PERMISSION,
    BACKOFFICE_ORGANIZATION_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_PROJECT_UPDATE_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
    BACKOFFICE_USER_READ_PERMISSION,
    ORGANIZATION_CREATE_PERMISSION,
  ],
} as const satisfies Record<string, readonly string[]>

/** Permissions granted per project role key. */
export const PROJECT_ROLE_PERMISSIONS = {
  project_owner: [
    "project.read",
    "project.update",
    "project.delete",
    "agent.create",
    "agent.read",
    DOCUMENT_READ_PERMISSION,
    DOCUMENT_CREATE_PERMISSION,
    DOCUMENT_UPDATE_PERMISSION,
    DOCUMENT_DELETE_PERMISSION,
    USER_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_PROJECT_UPDATE_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  project_admin: [
    "project.read",
    "project.update",
    "project.delete",
    "agent.create",
    "agent.read",
    DOCUMENT_READ_PERMISSION,
    DOCUMENT_CREATE_PERMISSION,
    DOCUMENT_UPDATE_PERMISSION,
    DOCUMENT_DELETE_PERMISSION,
    USER_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_PROJECT_UPDATE_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  project_member: ["project.read"],
} as const satisfies Record<string, readonly string[]>

/** Permissions granted per agent role key. */
export const AGENT_ROLE_PERMISSIONS = {
  agent_owner: [
    "agent.read",
    "agent.update",
    "agent.delete",
    USER_READ_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  agent_admin: [
    "agent.read",
    "agent.update",
    "agent.delete",
    USER_READ_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  agent_member: ["agent.read"],
} as const satisfies Record<string, readonly string[]>

export const RESOURCE_TYPE_READ_PERMISSION_MAP = {
  organization: "organization.read",
  project: "project.read",
  agent: "agent.read",
} as const satisfies Record<PermissionResourceType, string>

/**
 * Inverse of RESOURCE_TYPE_READ_PERMISSION_MAP: the public PermissionService
 * listing API is permission-first (`listResourceIds(userId, "organization.read")`)
 * and resolves the resource type from the permission key.
 * Backoffice read keys map to the same resource types: a global grant means
 * "this permission, everywhere"; a scoped grant means the resources where
 * the role holds that exact key.
 */
export const READ_PERMISSION_RESOURCE_TYPE_MAP = {
  "organization.read": "organization",
  "project.read": "project",
  "agent.read": "agent",
  [BACKOFFICE_ORGANIZATION_READ_PERMISSION]: "organization",
  [BACKOFFICE_PROJECT_READ_PERMISSION]: "project",
  [BACKOFFICE_AGENT_READ_PERMISSION]: "agent",
} as const satisfies Record<string, PermissionResourceType>

export type ResourceReadPermission = keyof typeof READ_PERMISSION_RESOURCE_TYPE_MAP

/**
 * Permissions that apply to a resource of a given type.
 * Used to filter the permissions inherited from a parent membership:
 * e.g. an org membership granting `project.read` cascades it to every
 * project of the org, but `organization.update` does not.
 */
export const RESOURCE_TYPE_PERMISSIONS_MAP = {
  organization: [
    "organization.read",
    "organization.update",
    "organization.delete",
    BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  ],
  project: [
    PROJECT_CREATE_PERMISSION,
    PROJECT_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_PROJECT_UPDATE_PERMISSION,
  ],
  agent: ["agent.read", "agent.update", "agent.delete", BACKOFFICE_AGENT_READ_PERMISSION],
} as const satisfies Record<PermissionResourceType, readonly string[]>

export const PARENT_RESOURCE_TYPE_MAP = {
  organization: [],
  project: ["organization"],
  agent: ["organization", "project"],
} as const satisfies Record<PermissionResourceType, readonly PermissionResourceType[]>

/** Official catalog role keys, in display order within each scope. */
export const CATALOG_ROLE_KEYS = [
  PLATFORM_STAFF_ROLE,
  PLATFORM_SUPERADMIN_ROLE,
  ORGANIZATION_ROLES.owner,
  ORGANIZATION_ROLES.admin,
  ORGANIZATION_ROLES.member,
  PROJECT_ROLES.owner,
  PROJECT_ROLES.admin,
  PROJECT_ROLES.member,
  AGENT_ROLES.owner,
  AGENT_ROLES.admin,
  AGENT_ROLES.member,
] as const

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  [ORGANIZATION_CREATE_PERMISSION]: "Create organizations",
  "organization.read": "See an organization",
  "organization.update": "Update an organization",
  "organization.delete": "Delete an organization",
  [PROJECT_CREATE_PERMISSION]: "Create projects in an organization",
  [PROJECT_READ_PERMISSION]: "See a project",
  [PROJECT_UPDATE_PERMISSION]: "Update a project",
  [PROJECT_DELETE_PERMISSION]: "Delete a project",
  "agent.create": "Create agents in a project",
  "agent.read": "See an agent",
  "agent.update": "Update an agent",
  "agent.delete": "Delete an agent",
  [DOCUMENT_READ_PERMISSION]: "See a document",
  [DOCUMENT_CREATE_PERMISSION]: "Create documents in a project",
  [DOCUMENT_UPDATE_PERMISSION]: "Update a document",
  [DOCUMENT_DELETE_PERMISSION]: "Delete a document",
  [USER_READ_PERMISSION]: "See the users who are members of a resource",
  [TRACE_READ_PERMISSION]: "See Langfuse trace links",
  [APP_INSTALL_PERMISSION]: "Install apps on a project",
  [BACKOFFICE_APP_MANAGE_PERMISSION]: "Manage app definitions in the backoffice",
  [BACKOFFICE_READ_PERMISSION]: "Access /backoffice routes",
  [BACKOFFICE_TERMS_UPDATE_PERMISSION]: "Manage terms documents",
  [BACKOFFICE_ORGANIZATION_READ_PERMISSION]: "See organizations in the backoffice",
  [BACKOFFICE_PROJECT_READ_PERMISSION]: "See projects in the backoffice",
  [BACKOFFICE_PROJECT_UPDATE_PERMISSION]:
    "Mutate a project from the backoffice (e.g. feature flags)",
  [BACKOFFICE_AGENT_READ_PERMISSION]: "See agents in the backoffice",
  [BACKOFFICE_USER_READ_PERMISSION]: "See every user in the backoffice",
}

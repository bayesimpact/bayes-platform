import {
  AGENT_ANALYTICS_READ_PERMISSION,
  AGENT_MEMBER_INVITE_PERMISSION,
  APP_GRANTABLE_PERMISSIONS,
  APP_INSTALL_PERMISSION,
  type AppGrantablePermission,
  BACKOFFICE_AGENT_READ_PERMISSION,
  BACKOFFICE_APP_MANAGE_PERMISSION,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
  BACKOFFICE_READ_PERMISSION,
  BACKOFFICE_TERMS_UPDATE_PERMISSION,
  BACKOFFICE_USER_READ_PERMISSION,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  EVALUATION_ACCESS_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
  ORGANIZATION_CREATE_PERMISSION,
  PROJECT_ANALYTICS_READ_PERMISSION,
  PROJECT_CREATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
  PROJECT_MEMBER_INVITE_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_UPDATE_PERMISSION,
  RESOURCE_LIBRARY_CREATE_PERMISSION,
  RESOURCE_LIBRARY_DELETE_PERMISSION,
  RESOURCE_LIBRARY_READ_PERMISSION,
  RESOURCE_LIBRARY_UPDATE_PERMISSION,
  TRACE_READ_PERMISSION,
  USER_READ_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { PermissionResourceType } from "./permission.types"

/**
 * Permission strings are declared in `@caseai-connect/api-contracts` and imported here.
 * Role keys and which role receives which permission stay in this file.
 */
export {
  AGENT_ANALYTICS_READ_PERMISSION,
  AGENT_MEMBER_INVITE_PERMISSION,
  APP_GRANTABLE_PERMISSIONS,
  APP_INSTALL_PERMISSION,
  type AppGrantablePermission,
  BACKOFFICE_AGENT_READ_PERMISSION,
  BACKOFFICE_APP_MANAGE_PERMISSION,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_PROJECT_UPDATE_PERMISSION,
  BACKOFFICE_READ_PERMISSION,
  BACKOFFICE_TERMS_UPDATE_PERMISSION,
  BACKOFFICE_USER_READ_PERMISSION,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  EVALUATION_ACCESS_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
  ORGANIZATION_CREATE_PERMISSION,
  PROJECT_ANALYTICS_READ_PERMISSION,
  PROJECT_MEMBER_INVITE_PERMISSION,
  PROJECT_CREATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_UPDATE_PERMISSION,
  RESOURCE_LIBRARY_CREATE_PERMISSION,
  RESOURCE_LIBRARY_DELETE_PERMISSION,
  RESOURCE_LIBRARY_READ_PERMISSION,
  RESOURCE_LIBRARY_UPDATE_PERMISSION,
  TRACE_READ_PERMISSION,
  USER_READ_PERMISSION,
}

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
    PROJECT_ANALYTICS_READ_PERMISSION,
    PROJECT_MEMBER_INVITE_PERMISSION,
    "agent.create",
    "agent.read",
    DOCUMENT_READ_PERMISSION,
    DOCUMENT_CREATE_PERMISSION,
    DOCUMENT_UPDATE_PERMISSION,
    DOCUMENT_DELETE_PERMISSION,
    DOCUMENT_SOURCE_READ_PERMISSION,
    DOCUMENT_SOURCE_CREATE_PERMISSION,
    DOCUMENT_SOURCE_UPDATE_PERMISSION,
    DOCUMENT_SOURCE_DELETE_PERMISSION,
    EVALUATION_ACCESS_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
    EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
    EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
    RESOURCE_LIBRARY_READ_PERMISSION,
    RESOURCE_LIBRARY_CREATE_PERMISSION,
    RESOURCE_LIBRARY_UPDATE_PERMISSION,
    RESOURCE_LIBRARY_DELETE_PERMISSION,
    USER_READ_PERMISSION,
    BACKOFFICE_PROJECT_READ_PERMISSION,
    BACKOFFICE_PROJECT_UPDATE_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  project_admin: [
    "project.read",
    "project.update",
    "project.delete",
    PROJECT_ANALYTICS_READ_PERMISSION,
    PROJECT_MEMBER_INVITE_PERMISSION,
    "agent.create",
    "agent.read",
    DOCUMENT_READ_PERMISSION,
    DOCUMENT_CREATE_PERMISSION,
    DOCUMENT_UPDATE_PERMISSION,
    DOCUMENT_DELETE_PERMISSION,
    DOCUMENT_SOURCE_READ_PERMISSION,
    DOCUMENT_SOURCE_CREATE_PERMISSION,
    DOCUMENT_SOURCE_UPDATE_PERMISSION,
    DOCUMENT_SOURCE_DELETE_PERMISSION,
    EVALUATION_ACCESS_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
    EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
    EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
    RESOURCE_LIBRARY_READ_PERMISSION,
    RESOURCE_LIBRARY_CREATE_PERMISSION,
    RESOURCE_LIBRARY_UPDATE_PERMISSION,
    RESOURCE_LIBRARY_DELETE_PERMISSION,
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
    AGENT_ANALYTICS_READ_PERMISSION,
    AGENT_MEMBER_INVITE_PERMISSION,
    USER_READ_PERMISSION,
    BACKOFFICE_AGENT_READ_PERMISSION,
  ],
  agent_admin: [
    "agent.read",
    "agent.update",
    "agent.delete",
    AGENT_ANALYTICS_READ_PERMISSION,
    AGENT_MEMBER_INVITE_PERMISSION,
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

/**
 * Official catalog role keys, in display order within each scope.
 * Custom install roles (`app_install_<installation_id>`) stay out of this list
 * so catalog reconcile and the back-office role picker never touch them.
 */
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
  [PROJECT_ANALYTICS_READ_PERMISSION]: "See a project's conversation analytics",
  [PROJECT_MEMBER_INVITE_PERMISSION]:
    "Invite people to a project or its review campaigns, and revoke pending invitations",
  "agent.create": "Create agents in a project",
  "agent.read": "See an agent",
  "agent.update": "Update an agent",
  "agent.delete": "Delete an agent",
  [AGENT_ANALYTICS_READ_PERMISSION]: "See an agent's conversation analytics",
  [AGENT_MEMBER_INVITE_PERMISSION]: "Invite people to an agent, and revoke pending invitations",
  [DOCUMENT_READ_PERMISSION]: "See a document",
  [DOCUMENT_CREATE_PERMISSION]: "Create documents in a project",
  [DOCUMENT_UPDATE_PERMISSION]: "Update a document",
  [DOCUMENT_DELETE_PERMISSION]: "Delete a document",
  [DOCUMENT_SOURCE_READ_PERMISSION]: "See document feeds in a project",
  [DOCUMENT_SOURCE_CREATE_PERMISSION]: "Register a document feed on a project",
  [DOCUMENT_SOURCE_UPDATE_PERMISSION]: "Update a document feed",
  [DOCUMENT_SOURCE_DELETE_PERMISSION]: "Delete a document feed",
  [EVALUATION_ACCESS_PERMISSION]: "Open a project's evaluation app",
  [EVALUATION_EXTRACTION_DATASET_READ_PERMISSION]:
    "See a project's evaluation extraction datasets and their files",
  [EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION]:
    "Create evaluation extraction datasets and upload their files",
  [EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION]: "Update an evaluation extraction dataset",
  [EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION]:
    "Delete an evaluation extraction dataset or one of its files",
  [EVALUATION_EXTRACTION_RUN_READ_PERMISSION]:
    "See a project's evaluation extraction runs and their results",
  [EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION]: "Create an evaluation extraction run",
  [EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION]:
    "Execute, retry or cancel an evaluation extraction run",
  [EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION]: "Delete an evaluation extraction run",
  [EVALUATION_CONVERSATION_DATASET_READ_PERMISSION]:
    "See a project's evaluation conversation datasets and their records",
  [EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION]: "Create an evaluation conversation dataset",
  [EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION]:
    "Rename an evaluation conversation dataset or edit its records",
  [EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION]: "Delete an evaluation conversation dataset",
  [EVALUATION_CONVERSATION_RUN_READ_PERMISSION]:
    "See a project's evaluation conversation runs and their results",
  [EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION]: "Create an evaluation conversation run",
  [EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION]:
    "Execute, retry or cancel an evaluation conversation run",
  [EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION]: "Delete an evaluation conversation run",
  [RESOURCE_LIBRARY_READ_PERMISSION]: "See a project's resource libraries",
  [RESOURCE_LIBRARY_CREATE_PERMISSION]:
    "Create a resource library, or upload a file for one of its resources",
  [RESOURCE_LIBRARY_UPDATE_PERMISSION]:
    "Rename a resource library, or add, edit and remove its resources",
  [RESOURCE_LIBRARY_DELETE_PERMISSION]: "Delete a resource library",
  [USER_READ_PERMISSION]: "See the users who are members of a resource",
  [TRACE_READ_PERMISSION]: "See trace links",
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

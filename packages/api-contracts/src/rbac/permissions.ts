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

/**
 * Permissions an App may be granted. Policy lives in code, not in the database.
 * Intersect this list with `AppManifest.grantable_permissions` on save and on authorize.
 */
export const APP_GRANTABLE_PERMISSIONS = [
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
] as const

export type AppGrantablePermission = (typeof APP_GRANTABLE_PERMISSIONS)[number]

export const PROJECT_CREATE_PERMISSION = "project.create" as const

export const PROJECT_READ_PERMISSION = "project.read" as const

/** See the users who are members of a resource you hold this permission on. */
export const USER_READ_PERMISSION = "user.read" as const

/** Org-scoped permissions: checked against an organization membership. */
export const ORGANIZATION_SCOPED_PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.delete",
  PROJECT_CREATE_PERMISSION,
  PROJECT_READ_PERMISSION,
  USER_READ_PERMISSION,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
  BACKOFFICE_PROJECT_READ_PERMISSION,
  BACKOFFICE_AGENT_READ_PERMISSION,
] as const

export type OrganizationScopedPermission = (typeof ORGANIZATION_SCOPED_PERMISSIONS)[number]

export type GlobalPermission =
  | typeof ORGANIZATION_CREATE_PERMISSION
  | typeof TRACE_READ_PERMISSION
  | typeof BACKOFFICE_READ_PERMISSION
  | typeof BACKOFFICE_ORGANIZATION_READ_PERMISSION
  | typeof BACKOFFICE_PROJECT_READ_PERMISSION
  | typeof BACKOFFICE_PROJECT_UPDATE_PERMISSION
  | typeof BACKOFFICE_AGENT_READ_PERMISSION
  | typeof BACKOFFICE_USER_READ_PERMISSION
  | typeof BACKOFFICE_TERMS_UPDATE_PERMISSION
  | typeof APP_INSTALL_PERMISSION
  | typeof BACKOFFICE_APP_MANAGE_PERMISSION

export type OrganizationPermission = OrganizationScopedPermission

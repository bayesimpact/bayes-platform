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

export const DOCUMENT_SOURCE_READ_PERMISSION = "document_source.read" as const

export const DOCUMENT_SOURCE_CREATE_PERMISSION = "document_source.create" as const

export const DOCUMENT_SOURCE_UPDATE_PERMISSION = "document_source.update" as const

export const DOCUMENT_SOURCE_DELETE_PERMISSION = "document_source.delete" as const

export const DOCUMENT_TAG_READ_PERMISSION = "document_tag.read" as const

export const DOCUMENT_TAG_CREATE_PERMISSION = "document_tag.create" as const

export const DOCUMENT_TAG_UPDATE_PERMISSION = "document_tag.update" as const

export const DOCUMENT_TAG_DELETE_PERMISSION = "document_tag.delete" as const

export const PROJECT_CREATE_PERMISSION = "project.create" as const

export const PROJECT_READ_PERMISSION = "project.read" as const

export const PROJECT_UPDATE_PERMISSION = "project.update" as const

export const PROJECT_DELETE_PERMISSION = "project.delete" as const

/** Read a project's conversation analytics. Not inherited from the organization. */
export const PROJECT_ANALYTICS_READ_PERMISSION = "project.analytics.read" as const

export const AGENT_CREATE_PERMISSION = "agent.create" as const

export const AGENT_READ_PERMISSION = "agent.read" as const

export const AGENT_UPDATE_PERMISSION = "agent.update" as const

export const AGENT_DELETE_PERMISSION = "agent.delete" as const

/**
 * Read an agent's conversation analytics. Held on the agent only: a project or
 * organization role does not grant it.
 */
export const AGENT_ANALYTICS_READ_PERMISSION = "agent.analytics.read" as const

/**
 * Invite people to a project or to one of its review campaigns, see the pending
 * invitations and revoke them. Not inherited from the organization.
 */
export const PROJECT_MEMBER_INVITE_PERMISSION = "project.member.invite" as const

/**
 * Change the role of another member of a project between admin and member. Not
 * inherited from the organization.
 */
export const PROJECT_MEMBER_UPDATE_PERMISSION = "project.member.update" as const

/**
 * Invite people to an agent, see its pending invitations and revoke them. Held
 * on the agent only: a project or organization role does not grant it.
 */
export const AGENT_MEMBER_INVITE_PERMISSION = "agent.member.invite" as const

/**
 * List the project's agents with their unpublished draft settings, as the studio and
 * evaluation apps do. Scoped to the project and never inherited from the organization.
 */
export const AGENT_DRAFT_READ_PERMISSION = "agent.draft.read" as const

/**
 * See and replace the sub-agents an agent can call. Held on the agent only: a project
 * or organization role does not grant them.
 */
export const AGENT_SUB_AGENT_READ_PERMISSION = "agent.sub_agent.read" as const

export const AGENT_SUB_AGENT_UPDATE_PERMISSION = "agent.sub_agent.update" as const

/**
 * See the revision history of an agent's settings, drafts included. Checked on the
 * agent, and granted on project roles that pass it down to every agent of the project.
 */
export const AGENT_SETTINGS_DRAFT_READ_PERMISSION = "agent.settings.draft.read" as const

/**
 * Edit an agent's draft settings, publish the draft as a new revision, restore an older
 * revision into the draft, or archive a revision. Held on the agent only: a project
 * or organization role does not grant them.
 */
export const AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION = "agent.settings.draft.update" as const

export const AGENT_SETTINGS_DRAFT_PUBLISH_PERMISSION = "agent.settings.draft.publish" as const

export const AGENT_SETTINGS_RESTORE_PERMISSION = "agent.settings.restore" as const

export const AGENT_SETTINGS_ARCHIVE_PERMISSION = "agent.settings.archive" as const

/**
 * Open a user interface of a project. One permission per app, scoped to the project
 * and never inherited from the organization.
 */
export const DESK_UI_READ_PERMISSION = "desk.ui.read" as const

export const STUDIO_UI_READ_PERMISSION = "studio.ui.read" as const

export const EVALUATION_UI_READ_PERMISSION = "evaluation.ui.read" as const

/**
 * Evaluation extraction datasets and the files they are built from. Scoped to the
 * project and never inherited from the organization.
 */
export const EVALUATION_EXTRACTION_DATASET_READ_PERMISSION =
  "evaluation.extraction.dataset.read" as const

export const EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION =
  "evaluation.extraction.dataset.create" as const

export const EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION =
  "evaluation.extraction.dataset.update" as const

export const EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION =
  "evaluation.extraction.dataset.delete" as const

/**
 * Evaluation extraction runs: an extraction agent run against a dataset, and its
 * records. Scoped to the project and never inherited from the organization.
 */
export const EVALUATION_EXTRACTION_RUN_READ_PERMISSION = "evaluation.extraction.run.read" as const

export const EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION =
  "evaluation.extraction.run.create" as const

/** Execute, retry or cancel an evaluation extraction run. */
export const EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION =
  "evaluation.extraction.run.update" as const

export const EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION =
  "evaluation.extraction.run.delete" as const

/**
 * Evaluation conversation datasets and their records. Scoped to the project and
 * never inherited from the organization.
 */
export const EVALUATION_CONVERSATION_DATASET_READ_PERMISSION =
  "evaluation.conversation.dataset.read" as const

export const EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION =
  "evaluation.conversation.dataset.create" as const

/** Rename an evaluation conversation dataset, or add, edit and remove its records. */
export const EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION =
  "evaluation.conversation.dataset.update" as const

export const EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION =
  "evaluation.conversation.dataset.delete" as const

/**
 * Evaluation conversation runs: a conversation agent run against a dataset, and its
 * records. Scoped to the project and never inherited from the organization.
 */
export const EVALUATION_CONVERSATION_RUN_READ_PERMISSION =
  "evaluation.conversation.run.read" as const

export const EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION =
  "evaluation.conversation.run.create" as const

/** Execute, retry or cancel an evaluation conversation run. */
export const EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION =
  "evaluation.conversation.run.update" as const

export const EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION =
  "evaluation.conversation.run.delete" as const

/**
 * Resource libraries of a project and the resources they hold. Scoped to the
 * project and never inherited from the organization.
 */
export const RESOURCE_LIBRARY_READ_PERMISSION = "resource_library.read" as const

/** Create a resource library, or upload a file for one of its resources. */
export const RESOURCE_LIBRARY_CREATE_PERMISSION = "resource_library.create" as const

/** Rename a resource library, or add, edit and remove its resources. */
export const RESOURCE_LIBRARY_UPDATE_PERMISSION = "resource_library.update" as const

export const RESOURCE_LIBRARY_DELETE_PERMISSION = "resource_library.delete" as const

/**
 * Live CSV extraction runs: an extraction agent run over the rows of a CSV document, and its
 * records. Scoped to the project and never inherited from the organization.
 */
export const CSV_EXTRACTION_RUN_READ_PERMISSION = "csv_extraction_run.read" as const

export const CSV_EXTRACTION_RUN_CREATE_PERMISSION = "csv_extraction_run.create" as const

/** Execute, retry or cancel a CSV extraction run. */
export const CSV_EXTRACTION_RUN_UPDATE_PERMISSION = "csv_extraction_run.update" as const

export const CSV_EXTRACTION_RUN_DELETE_PERMISSION = "csv_extraction_run.delete" as const

/**
 * Playground CSV extraction runs. They belong to the Studio surface, so only project owners and
 * admins hold these keys. Scoped to the project and never inherited from the organization.
 */
export const CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION =
  "csv_extraction_run.playground.read" as const

export const CSV_EXTRACTION_RUN_PLAYGROUND_CREATE_PERMISSION =
  "csv_extraction_run.playground.create" as const

/** Execute, retry or cancel a playground CSV extraction run. */
export const CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION =
  "csv_extraction_run.playground.update" as const

export const CSV_EXTRACTION_RUN_PLAYGROUND_DELETE_PERMISSION =
  "csv_extraction_run.playground.delete" as const

/**
 * Permissions an App may be granted. Policy lives in code, not in the database:
 * there is no Permission entity and no `app_grantable` column. Intersect this
 * list with `AppManifest.grantable_permissions` on save and on authorize.
 * Grouped by resource type (document, document source, document tag, project/workspace, agent, …).
 */
export const APP_GRANTABLE_PERMISSIONS = [
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_TAG_READ_PERMISSION,
  DOCUMENT_TAG_CREATE_PERMISSION,
  DOCUMENT_TAG_UPDATE_PERMISSION,
  DOCUMENT_TAG_DELETE_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_UPDATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
] as const

export type AppGrantablePermission = (typeof APP_GRANTABLE_PERMISSIONS)[number]

/** Product labels for the resource-type prefix of an App-grantable permission. */
export const APP_GRANTABLE_RESOURCE_LABELS = {
  document: "Document",
  document_source: "Document source",
  document_tag: "Document tag",
  project: "Workspace",
  agent: "Agent",
  organization: "Organization",
} as const

export type AppGrantableResourceType = keyof typeof APP_GRANTABLE_RESOURCE_LABELS

export type AppGrantablePermissionGroup = {
  resourceType: string
  label: string
  permissions: AppGrantablePermission[]
}

export function groupAppGrantablePermissions(
  permissions: readonly AppGrantablePermission[] = APP_GRANTABLE_PERMISSIONS,
): AppGrantablePermissionGroup[] {
  const groups: AppGrantablePermissionGroup[] = []
  for (const permission of permissions) {
    const resourceType = permission.split(".")[0] ?? permission
    const existingGroup = groups.find((group) => group.resourceType === resourceType)
    if (existingGroup) {
      existingGroup.permissions.push(permission)
      continue
    }
    const label =
      resourceType in APP_GRANTABLE_RESOURCE_LABELS
        ? APP_GRANTABLE_RESOURCE_LABELS[resourceType as AppGrantableResourceType]
        : resourceType
    groups.push({ resourceType, label, permissions: [permission] })
  }
  return groups
}

export function appGrantablePermissionActionLabel(permission: AppGrantablePermission): string {
  const action = permission.slice(permission.indexOf(".") + 1)
  if (!action) return permission
  return action.charAt(0).toUpperCase() + action.slice(1)
}

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

/** Project-scoped permissions exposed on `ProjectDto.permissions`. */
export const PROJECT_SCOPED_PERMISSIONS = [
  DESK_UI_READ_PERMISSION,
  STUDIO_UI_READ_PERMISSION,
  EVALUATION_UI_READ_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  PROJECT_MEMBER_UPDATE_PERMISSION,
] as const

export type ProjectScopedPermission = (typeof PROJECT_SCOPED_PERMISSIONS)[number]

export type ProjectPermission = ProjectScopedPermission

const PROJECT_SCOPED_PERMISSION_SET: ReadonlySet<string> = new Set(PROJECT_SCOPED_PERMISSIONS)

export function isProjectPermission(permission: string): permission is ProjectPermission {
  return PROJECT_SCOPED_PERMISSION_SET.has(permission)
}

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

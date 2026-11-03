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

/**
 * Grant or revoke, from the backoffice, the right to read any conversation of one agent from its
 * session id (safety review). That right itself is kept per agent, outside the role catalog.
 */
export const BACKOFFICE_CONVERSATION_REVIEWER_UPDATE_PERMISSION =
  "backoffice.conversation_reviewer.update" as const

/**
 * Read any conversation of an agent from its session id, whoever had it (safety review).
 * Scoped to the agent and held only by the `agent_conversation_reviewer` role, which nobody has by
 * default: it is granted person by person and agent by agent from the backoffice.
 */
export const AGENT_CONVERSATION_REVIEW_PERMISSION = "agent.conversation.review" as const

/**
 * List an agent's conversations, grouped by category, for safety review: the session list the
 * reviewer picks a session from. Scoped to the agent and held only by the
 * `agent_conversation_reviewer` role, granted with `agent.conversation.review` and no other role.
 */
export const AGENT_CONVERSATION_REVIEW_CATEGORY_READ_PERMISSION =
  "agent.conversation.review.category.read" as const

/** AppManifest back-office CRUD, and the OAuth client of each app. Superadmin only. */
export const BACKOFFICE_APP_MANAGE_PERMISSION = "backoffice.app.manage" as const

/**
 * See and run the maintenance jobs of the backoffice: one-off data migrations that run in the
 * workers across every organization. Superadmin only.
 */
export const BACKOFFICE_MAINTENANCE_JOB_RUN_PERMISSION = "backoffice.maintenance_job.run" as const

/** Grant or revoke a user's global roles from the backoffice user page. Superadmin only. */
export const BACKOFFICE_GLOBAL_ROLE_UPDATE_PERMISSION = "backoffice.global_role.update" as const

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
 * Copy an agent into a new draft agent of its project, with its settings, tools, sub-agents and
 * sources. Held on the agent only, since the copy carries its sub-agents, and the copy also needs
 * `agent.create` on the project.
 */
export const AGENT_DUPLICATE_PERMISSION = "agent.duplicate" as const

/**
 * Read an agent's conversation analytics. Held on the agent only: a project or
 * organization role does not grant it.
 */
export const AGENT_ANALYTICS_READ_PERMISSION = "agent.analytics.read" as const

/**
 * Invite people to a project, see the pending invitations and revoke them. Not
 * inherited from the organization.
 */
export const PROJECT_MEMBER_INVITE_PERMISSION = "project.member.invite" as const

/**
 * Change the role of another member of a project between admin and member. Not
 * inherited from the organization.
 */
export const PROJECT_MEMBER_UPDATE_PERMISSION = "project.member.update" as const

/**
 * See a project's members, their roles and the agents each one can reach. Not inherited
 * from the organization.
 */
export const PROJECT_MEMBER_READ_PERMISSION = "project.member.read" as const

/** Remove a member from a project. Not inherited from the organization. */
export const PROJECT_MEMBER_DELETE_PERMISSION = "project.member.delete" as const

/**
 * Invite people to an agent, see its pending invitations and revoke them. Held
 * on the agent only: a project or organization role does not grant it.
 */
export const AGENT_MEMBER_INVITE_PERMISSION = "agent.member.invite" as const

/**
 * See an agent's members and their roles, or remove one. Held on the agent only: a
 * project or organization role does not grant them.
 */
export const AGENT_MEMBER_READ_PERMISSION = "agent.member.read" as const

export const AGENT_MEMBER_DELETE_PERMISSION = "agent.member.delete" as const

/** Give a member of the workspace a role on the agent, or take one away. Held on the agent only. */
export const AGENT_MEMBER_UPDATE_PERMISSION = "agent.member.update" as const

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

/**
 * Open a conversation with an agent on behalf of people outside the platform, and
 * send their messages. Granted on no catalog role: only an App holds it, through
 * its install role, which passes it down to every agent of the project.
 */
export const AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION =
  "agent.conversation.session.external.create" as const

export const AGENT_SETTINGS_ARCHIVE_PERMISSION = "agent.settings.archive" as const

/**
 * Open a user interface of a project. One permission per app, scoped to the project
 * and never inherited from the organization.
 */
export const DESK_UI_READ_PERMISSION = "desk.ui.read" as const

export const STUDIO_UI_READ_PERMISSION = "studio.ui.read" as const

export const EVALUATION_UI_READ_PERMISSION = "evaluation.ui.read" as const

/**
 * The tester and reviewer apps of a project. Only a review campaign role gives them, on the
 * campaign's project, while the campaign status lets the role take part.
 */
export const TESTER_UI_READ_PERMISSION = "tester.ui.read" as const

export const REVIEWER_UI_READ_PERMISSION = "reviewer.ui.read" as const

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
 * Live conversation sessions: the caller's own chats with an agent, and the sub-sessions they
 * spawned. Scoped to the project and never inherited from the organization.
 */
export const AGENT_CONVERSATION_SESSION_READ_PERMISSION = "agent.conversation.session.read" as const

export const AGENT_CONVERSATION_SESSION_CREATE_PERMISSION =
  "agent.conversation.session.create" as const

export const AGENT_CONVERSATION_SESSION_DELETE_PERMISSION =
  "agent.conversation.session.delete" as const

/**
 * Playground conversation sessions. They belong to the Studio surface, so only project owners
 * and admins hold these keys. Scoped to the project and never inherited from the organization.
 */
export const AGENT_CONVERSATION_SESSION_PLAYGROUND_READ_PERMISSION =
  "agent.conversation.session.playground.read" as const

export const AGENT_CONVERSATION_SESSION_PLAYGROUND_CREATE_PERMISSION =
  "agent.conversation.session.playground.create" as const

export const AGENT_CONVERSATION_SESSION_PLAYGROUND_DELETE_PERMISSION =
  "agent.conversation.session.playground.delete" as const

/**
 * Live extraction sessions: the caller's own runs of an extraction agent, the documents they
 * uploaded to feed them, and the status stream. Scoped to the project and never inherited from
 * the organization.
 */
export const AGENT_EXTRACTION_SESSION_READ_PERMISSION = "agent.extraction.session.read" as const

/** Upload a document and run an extraction agent on it. */
export const AGENT_EXTRACTION_SESSION_CREATE_PERMISSION = "agent.extraction.session.create" as const

export const AGENT_EXTRACTION_SESSION_DELETE_PERMISSION = "agent.extraction.session.delete" as const

/**
 * Playground extraction sessions. They belong to the Studio surface, so only project owners and
 * admins hold these keys. Scoped to the project and never inherited from the organization.
 */
export const AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION =
  "agent.extraction.session.playground.read" as const

export const AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION =
  "agent.extraction.session.playground.create" as const

export const AGENT_EXTRACTION_SESSION_PLAYGROUND_DELETE_PERMISSION =
  "agent.extraction.session.playground.delete" as const

/**
 * Session categories of a project, used to tag its agents' conversations. Scoped to the project
 * and never inherited from the organization.
 */
export const PROJECT_AGENT_SESSION_CATEGORY_CREATE_PERMISSION =
  "project.agent_session_category.create" as const

export const PROJECT_AGENT_SESSION_CATEGORY_DELETE_PERMISSION =
  "project.agent_session_category.delete" as const

/**
 * Feedback left on an agent's messages. Every project role can leave feedback from a
 * conversation, while reading an agent's feedback stays with project owners and admins.
 * Scoped to the project and never inherited from the organization.
 */
export const PROJECT_AGENT_MESSAGE_FEEDBACK_READ_PERMISSION =
  "project.agent_message_feedback.read" as const

export const PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION =
  "project.agent_message_feedback.create" as const

/**
 * Apps installed on a project: installed through the consent page of the OAuth server (ADR 0029),
 * listed and revoked from the studio. Scoped to the project and never inherited from the
 * organization.
 */
export const PROJECT_APP_INSTALLATION_CREATE_PERMISSION = "project.app_installation.create" as const

export const PROJECT_APP_INSTALLATION_READ_PERMISSION = "project.app_installation.read" as const

export const PROJECT_APP_INSTALLATION_REVOKE_PERMISSION = "project.app_installation.revoke" as const

/**
 * MCP servers of a project, and turning them on or off for its agents. Scoped to the project
 * and never inherited from the organization.
 */
export const PROJECT_MCP_SERVER_READ_PERMISSION = "project.mcp_server.read" as const

export const PROJECT_MCP_SERVER_CREATE_PERMISSION = "project.mcp_server.create" as const

/** Turn a server on or off for an agent, or connect it through OAuth. */
export const PROJECT_MCP_SERVER_UPDATE_PERMISSION = "project.mcp_server.update" as const

export const PROJECT_MCP_SERVER_DELETE_PERMISSION = "project.mcp_server.delete" as const

/**
 * Review campaigns of a project, managed from the campaign editor. Scoped to the project
 * and never inherited from the organization.
 */
export const PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION = "project.review_campaign.read" as const

export const PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION = "project.review_campaign.create" as const

export const PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION = "project.review_campaign.update" as const

export const PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION = "project.review_campaign.delete" as const

/** Remove a tester or a reviewer from a review campaign. */
export const PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION =
  "project.review_campaign.member.delete" as const

/**
 * Invite testers and reviewers to a project's review campaigns, see the pending invitations
 * and revoke them. Scoped to the project and never inherited from the organization.
 */
export const PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION =
  "project.review_campaign.member.invite" as const

/**
 * Taking part in one review campaign, as a tester or a reviewer. Scoped to the campaign and held
 * by the `review_campaign_tester` and `review_campaign_reviewer` roles, given when someone accepts
 * an invitation to the campaign. Never inherited from the project, except `review_campaign.report.read`.
 */
export const REVIEW_CAMPAIGN_READ_PERMISSION = "review_campaign.read" as const

export const REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION =
  "review_campaign.tester_session.read" as const

export const REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION =
  "review_campaign.tester_session.create" as const

export const REVIEW_CAMPAIGN_TESTER_SESSION_DELETE_PERMISSION =
  "review_campaign.tester_session.delete" as const

export const REVIEW_CAMPAIGN_TESTER_FEEDBACK_CREATE_PERMISSION =
  "review_campaign.tester_feedback.create" as const

export const REVIEW_CAMPAIGN_TESTER_FEEDBACK_UPDATE_PERMISSION =
  "review_campaign.tester_feedback.update" as const

export const REVIEW_CAMPAIGN_TESTER_SURVEY_READ_PERMISSION =
  "review_campaign.tester_survey.read" as const

export const REVIEW_CAMPAIGN_TESTER_SURVEY_CREATE_PERMISSION =
  "review_campaign.tester_survey.create" as const

export const REVIEW_CAMPAIGN_TESTER_SURVEY_UPDATE_PERMISSION =
  "review_campaign.tester_survey.update" as const

export const REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION =
  "review_campaign.reviewer_session.read" as const

export const REVIEW_CAMPAIGN_REVIEWER_REVIEW_CREATE_PERMISSION =
  "review_campaign.reviewer_review.create" as const

export const REVIEW_CAMPAIGN_REVIEWER_REVIEW_UPDATE_PERMISSION =
  "review_campaign.reviewer_review.update" as const

/** See a campaign's report. Held by reviewers, and passed down from project owners and admins. */
export const REVIEW_CAMPAIGN_REPORT_READ_PERMISSION = "review_campaign.report.read" as const

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
  AGENT_READ_PERMISSION,
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
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

/** Action labels that the permission key does not spell well on its own. */
const APP_GRANTABLE_ACTION_LABELS: Partial<Record<AppGrantablePermission, string>> = {
  [AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION]: "Chat for people outside Bayes",
}

export function appGrantablePermissionActionLabel(permission: AppGrantablePermission): string {
  const label = APP_GRANTABLE_ACTION_LABELS[permission]
  if (label) return label
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
  TESTER_UI_READ_PERMISSION,
  REVIEWER_UI_READ_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  // The studio offers the embedding model manager to who can list and re-embed the documents.
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  PROJECT_MEMBER_UPDATE_PERMISSION,
  PROJECT_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_APP_INSTALLATION_READ_PERMISSION,
  PROJECT_APP_INSTALLATION_REVOKE_PERMISSION,
  PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
  AGENT_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
] as const

export type ProjectScopedPermission = (typeof PROJECT_SCOPED_PERMISSIONS)[number]

export type ProjectPermission = ProjectScopedPermission

const PROJECT_SCOPED_PERMISSION_SET: ReadonlySet<string> = new Set(PROJECT_SCOPED_PERMISSIONS)

export function isProjectPermission(permission: string): permission is ProjectPermission {
  return PROJECT_SCOPED_PERMISSION_SET.has(permission)
}

/** Agent-scoped permissions exposed on `AgentDto.permissions`: what the studio gates on an agent. */
export const AGENT_SCOPED_PERMISSIONS = [
  AGENT_UPDATE_PERMISSION,
  AGENT_DELETE_PERMISSION,
  AGENT_DUPLICATE_PERMISSION,
  AGENT_MEMBER_READ_PERMISSION,
  AGENT_MEMBER_INVITE_PERMISSION,
  AGENT_MEMBER_UPDATE_PERMISSION,
  AGENT_MEMBER_DELETE_PERMISSION,
] as const

export type AgentPermission = (typeof AGENT_SCOPED_PERMISSIONS)[number]

const AGENT_SCOPED_PERMISSION_SET: ReadonlySet<string> = new Set(AGENT_SCOPED_PERMISSIONS)

export function isAgentPermission(permission: string): permission is AgentPermission {
  return AGENT_SCOPED_PERMISSION_SET.has(permission)
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
  | typeof BACKOFFICE_CONVERSATION_REVIEWER_UPDATE_PERMISSION
  | typeof BACKOFFICE_APP_MANAGE_PERMISSION
  | typeof BACKOFFICE_MAINTENANCE_JOB_RUN_PERMISSION
  | typeof BACKOFFICE_GLOBAL_ROLE_UPDATE_PERMISSION

export type OrganizationPermission = OrganizationScopedPermission

/** An agent of the workspace that an invitation can give access to. */
export type InviteAgent = {
  id: string
  name: string
  /** A short qualifier next to the name: the agent's type. */
  detail?: string
}

/**
 * What the invite dialog sends: who is invited, and what they get on accepting, once. Each agent
 * picked gives its member role: the dialog offers no other role on agents.
 */
export type InviteMembersValues = {
  emails: string[]
  workspaceRoleKey: string
  agentIds: string[]
}

/** The workspace role whose holders are admins of every agent, so the dialog picks no agent. */
export const WORKSPACE_ADMIN_ROLE_KEY = "project_admin"

/** What each workspace role gives, under its name in both screens of the dialog. */
export const WORKSPACE_ROLE_DESCRIPTIONS: Record<string, string> = {
  project_admin: "Manages the workspace, its members and every agent.",
  project_member: "Uses only the agents picked for them.",
}

/** The footer of both screens, kept in view while the dialog scrolls, over its bottom padding. */
export const STICKY_FOOTER_CLASS =
  "sticky -bottom-6 -mx-6 -mb-6 rounded-b-lg border-t bg-background px-6 py-4"

import type { RoleOption } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"

/** An agent or a review campaign of the workspace that an invitation can give a role on. */
export type InviteTarget = {
  id: string
  name: string
  /** A short qualifier next to the name: the agent's type, the campaign's status. */
  detail?: string
  /** False when the inviter lacks the invite permission on this target: it shows, disabled. */
  canInvite: boolean
}

/** A role picked on one target. */
export type InviteTargetRole = {
  targetId: string
  roleKey: string
}

/** What the invite dialog sends: who is invited, and what they get on accepting, once. */
export type InviteMembersValues = {
  emails: string[]
  workspaceRoleKey: string
  agents: InviteTargetRole[]
  campaigns: InviteTargetRole[]
}

/** The roles each kind of target offers in the dialog. */
export type InviteRoleCatalog = {
  workspace: RoleOption[]
  agent: RoleOption[]
  campaign: RoleOption[]
}

/** The workspace role whose holders are admins of every agent, so the dialog picks no agent. */
export const WORKSPACE_ADMIN_ROLE_KEY = "project_admin"

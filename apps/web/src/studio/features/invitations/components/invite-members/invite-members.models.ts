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

/**
 * What a person already in the workspace holds there, or what their pending invitation to it
 * gives, shown on the confirmation screen.
 */
export type InviteeAccess = {
  workspaceRoleKey: string
  agentIds: string[]
  /** True for a pending invitation: the person is not in the workspace yet. */
  invited?: boolean
}

/**
 * What the invitation does for a person already in the workspace. They accepted once already, so
 * what is missing is given right away, with no invitation. A promotion to admin is never a side
 * effect: it is done from their member page. For a person already invited, the agents missing
 * are added to their pending invitation, which is emailed again.
 */
export type ExistingInviteeOutcome =
  | { kind: "addAgents"; agentIds: string[] }
  | { kind: "addToInvitation"; agentIds: string[] }
  | { kind: "unchanged"; reason: "hasAccess" | "noPromotion" | "alreadyInvited" }

export function existingInviteeOutcome(
  access: InviteeAccess,
  values: InviteMembersValues,
): ExistingInviteeOutcome {
  if (access.invited) {
    const agentIds = missingAgentIds(access, values)
    return access.workspaceRoleKey === WORKSPACE_MEMBER_ROLE_KEY &&
      values.workspaceRoleKey === WORKSPACE_MEMBER_ROLE_KEY &&
      agentIds.length > 0
      ? { kind: "addToInvitation", agentIds }
      : { kind: "unchanged", reason: "alreadyInvited" }
  }
  if (access.workspaceRoleKey !== WORKSPACE_MEMBER_ROLE_KEY) {
    return { kind: "unchanged", reason: "hasAccess" }
  }
  if (values.workspaceRoleKey === WORKSPACE_ADMIN_ROLE_KEY) {
    return { kind: "unchanged", reason: "noPromotion" }
  }
  const agentIds = missingAgentIds(access, values)
  return agentIds.length > 0
    ? { kind: "addAgents", agentIds }
    : { kind: "unchanged", reason: "hasAccess" }
}

/** Whether the outcome changes anything, so the person is sent with the invitation. */
export function changesAccess(outcome: ExistingInviteeOutcome): boolean {
  return outcome.kind !== "unchanged"
}

function missingAgentIds(access: InviteeAccess, values: InviteMembersValues): string[] {
  return values.agentIds.filter((agentId) => !access.agentIds.includes(agentId))
}

/** The workspace role whose holders are admins of every agent, so the dialog picks no agent. */
export const WORKSPACE_ADMIN_ROLE_KEY = "project_admin"

/**
 * The only workspace role an invitation can add agents to: owners and admins are admins of every
 * agent.
 */
export const WORKSPACE_MEMBER_ROLE_KEY = "project_member"

/** The footer of both screens, kept in view while the dialog scrolls, over its bottom padding. */
export const STICKY_FOOTER_CLASS =
  "sticky -bottom-6 -mx-6 -mb-6 rounded-b-lg border-t bg-background px-6 py-4"

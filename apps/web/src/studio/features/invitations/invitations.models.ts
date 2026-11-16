export type InvitationTargetType = "project" | "agent" | "review_campaign"

/** An agent a workspace invitation also gives, with its member role. */
export type InvitationAgent = {
  id: string
  name: string
}

/**
 * Access to a project, an agent or a review campaign offered by email. No
 * email is sent: the invited person finds it in the app after signing in and
 * accepts or declines it.
 */
export type PendingInvitation = {
  id: string
  targetType: InvitationTargetType
  targetId: string
  organizationId: string
  projectId: string
  invitedEmail: string
  role: string
  invitedAt: number
  organizationName: string
  projectName: string
  targetName: string
  /**
   * The agents a workspace invitation also gives. Empty for other invitations, and for a
   * workspace admin, who is admin of every agent.
   */
  agents: InvitationAgent[]
}

export type PendingInvitations = PendingInvitation[]

/** Result of inviting people: the new invitations, and whether the platform emailed them all. */
export type CreatedInvitations = {
  invitations: PendingInvitations
  emailSent: boolean
  /** People already in the workspace who got the agents they missed right away. */
  grantedEmails: string[]
}

export type InvitationTargetType = "project" | "agent" | "review_campaign"

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
}

export type PendingInvitations = PendingInvitation[]

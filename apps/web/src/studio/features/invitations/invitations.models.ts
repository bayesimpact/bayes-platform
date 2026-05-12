export type PendingInvitationTargetType = "project" | "agent" | "review_campaign"

export type PendingInvitationItem = {
  id: string
  targetType: PendingInvitationTargetType
  targetId: string
  organizationId: string
  projectId: string
  invitedEmail: string | null
  role: string
  invitationToken: string
  invitedAt: number
  organizationName: string
  projectName: string
  targetName: string
}

export type PendingInvitations = PendingInvitationItem[]

import type { TimeType } from "../generic"

export type InvitationTargetTypeDto = "project" | "agent" | "review_campaign"

export type InvitationStatusDto = "pending" | "accepted" | "declined" | "revoked" | "expired"

/**
 * Access to a project, an agent or a review campaign offered to someone by
 * email. The platform sends no email: the invited person finds the
 * invitation in the app after signing in, and accepts or declines it.
 */
export type InvitationDto = {
  id: string
  organizationId: string
  projectId: string
  targetType: InvitationTargetTypeDto
  targetId: string
  invitedEmail: string
  role: string
  status: InvitationStatusDto
  invitedAt: TimeType
  acceptedAt: TimeType | null
  organizationName: string
  projectName: string
  targetName: string
}

export type CreateInvitationsRequestDto = {
  emails: string[]
}

export type ReviewCampaignInvitationRoleDto = "tester" | "reviewer"

export type CreateReviewCampaignInvitationsRequestDto = CreateInvitationsRequestDto & {
  role: ReviewCampaignInvitationRoleDto
}

export type CreateInvitationsResponseDto = {
  /** New pending invitations. Emails that already have access or a pending invitation are left out. */
  invitations: InvitationDto[]
}

export type ListInvitationsResponseDto = {
  invitations: InvitationDto[]
}

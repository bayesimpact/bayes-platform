import type { TimeType } from "../generic"

export type InvitationTargetTypeDto = "project" | "agent" | "review_campaign"

export type InvitationStatusDto = "pending" | "accepted" | "revoked" | "expired"

export type InvitationDto = {
  id: string
  organizationId: string
  projectId: string
  targetType: InvitationTargetTypeDto
  targetId: string
  userId: string | null
  invitedEmail: string | null
  role: string
  invitationToken: string
  status: InvitationStatusDto
  invitedAt: TimeType
  acceptedAt: TimeType | null
  organizationName: string
  projectName: string
  targetName: string
}

export type CreateInvitationsRequestDto = {
  targetType: InvitationTargetTypeDto
  targetId: string
  emails: string[]
  role?: string
}

export type CreateInvitationsResponseDto = {
  invitations: InvitationDto[]
}

export type ListInvitationsResponseDto = {
  invitations: InvitationDto[]
}

import type { PendingInvitations, PendingInvitationTargetType } from "./invitations.models"

export type CreateInvitationsForTargetParams = {
  targetType: PendingInvitationTargetType
  targetId: string
  emails: string[]
  role?: string
}

export type ListInvitationsForTargetParams = {
  targetType: PendingInvitationTargetType
  targetId: string
}

export interface IInvitationsSpi {
  acceptInvitation: (ticketId: string) => Promise<void>
  revokeInvitation: (invitationId: string) => Promise<void>
  createForTarget: (params: CreateInvitationsForTargetParams) => Promise<PendingInvitations>
  listPendingMine: () => Promise<PendingInvitations>
  listForTarget: (params: ListInvitationsForTargetParams) => Promise<PendingInvitations>
}

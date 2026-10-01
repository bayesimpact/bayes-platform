import type { InvitationTargetType, PendingInvitations } from "./invitations.models"

export type InvitationTarget = {
  targetType: InvitationTargetType
  targetId: string
}

export type CreateInvitationsParams = InvitationTarget & {
  emails: string[]
  role?: string
}

export interface IInvitationsSpi {
  createMany: (params: CreateInvitationsParams) => Promise<PendingInvitations>
  listForTarget: (params: InvitationTarget) => Promise<PendingInvitations>
  revokeOne: (invitationId: string) => Promise<void>
  listPendingMine: () => Promise<PendingInvitations>
  acceptOne: (invitationId: string) => Promise<void>
  declineOne: (invitationId: string) => Promise<void>
}

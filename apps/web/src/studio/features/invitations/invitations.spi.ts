import type {
  CreatedInvitations,
  InvitationTargetType,
  PendingInvitations,
} from "./invitations.models"

export type InvitationTarget = {
  targetType: InvitationTargetType
  targetId: string
}

/** A target located in its organization and project, as the admin routes need it. */
export type ScopedInvitationTarget = InvitationTarget & {
  organizationId: string
  projectId: string
}

export type CreateInvitationsParams = InvitationTarget & {
  emails: string[]
  /** Review campaign role (tester or reviewer). Required for review campaigns. */
  role?: string
}

export interface IInvitationsSpi {
  createMany: (
    params: ScopedInvitationTarget & Omit<CreateInvitationsParams, keyof InvitationTarget>,
  ) => Promise<CreatedInvitations>
  listForTarget: (params: ScopedInvitationTarget) => Promise<PendingInvitations>
  revokeOne: (params: ScopedInvitationTarget & { invitationId: string }) => Promise<void>
  listPendingMine: () => Promise<PendingInvitations>
  acceptOne: (invitationId: string) => Promise<void>
  declineOne: (invitationId: string) => Promise<void>
}

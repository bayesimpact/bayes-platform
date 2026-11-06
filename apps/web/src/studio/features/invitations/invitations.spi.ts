import type { InviteeAccess } from "./components/invite-members/invite-members.models"
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
  /**
   * Review campaign role (tester or reviewer), required for review campaigns. On a workspace,
   * `admin` or `member`.
   */
  role?: string
  /** The agents a workspace invitation for members also gives. */
  agentIds?: string[]
}

/** What each person already in the workspace holds, by email. */
export type InviteeAccessByEmail = Record<string, InviteeAccess>

export interface IInvitationsSpi {
  createMany: (
    params: ScopedInvitationTarget & Omit<CreateInvitationsParams, keyof InvitationTarget>,
  ) => Promise<CreatedInvitations>
  listForTarget: (params: ScopedInvitationTarget) => Promise<PendingInvitations>
  listInviteeAccess: (params: {
    organizationId: string
    projectId: string
  }) => Promise<InviteeAccessByEmail>
  revokeOne: (params: ScopedInvitationTarget & { invitationId: string }) => Promise<void>
  listPendingMine: () => Promise<PendingInvitations>
  acceptOne: (invitationId: string) => Promise<void>
  declineOne: (invitationId: string) => Promise<void>
}

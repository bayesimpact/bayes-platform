import type { PendingInvitations } from "./invitations.models"

export interface IInvitationsSpi {
  acceptInvitation: (ticketId: string) => Promise<void>
  listPendingMine: () => Promise<PendingInvitations>
}

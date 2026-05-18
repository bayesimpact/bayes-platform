export type InvitationAcceptanceType = "agent" | "project" | "reviewCampaign"

export interface InvitationAcceptanceHandler {
  acceptanceType: InvitationAcceptanceType
  canHandle(ticketId: string): Promise<boolean>
  acceptInvitation(params: { ticketId: string; auth0Sub: string; email: string }): Promise<{
    userId: string
  }>
}

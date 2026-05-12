import type { InvitationTargetTypeDto } from "@caseai-connect/api-contracts"
import type { Invitation } from "../invitation.entity"

export type InvitationTargetScope = {
  organizationId: string
  projectId: string
}

export type CreateInvitationsForTargetParams = {
  targetId: string
  emails: string[]
  role?: string
  inviterName: string
}

export interface InvitationTargetHandler {
  targetType: InvitationTargetTypeDto
  resolveScope(targetId: string): Promise<InvitationTargetScope>
  createInvitations(params: CreateInvitationsForTargetParams): Promise<Invitation[]>
  resolveTargetNameByInvitationId(invitations: Invitation[]): Promise<Map<string, string>>
}

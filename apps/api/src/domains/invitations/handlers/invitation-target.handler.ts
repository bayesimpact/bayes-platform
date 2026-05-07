import type { InvitationTargetTypeDto } from "@caseai-connect/api-contracts"
import type { Invitation } from "../invitation.entity"

export type InvitationTargetScope = {
  organizationId: string
  projectId: string
}

export interface InvitationTargetHandler {
  targetType: InvitationTargetTypeDto
  resolveScope(targetId: string): Promise<InvitationTargetScope>
  resolveTargetNameByInvitationId(invitations: Invitation[]): Promise<Map<string, string>>
}

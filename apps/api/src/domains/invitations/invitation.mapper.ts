import type { InvitationDto } from "@caseai-connect/api-contracts"
import type { Invitation } from "./invitation.entity"
import type { InvitationDetails } from "./invitation.repository"

export function toInvitationDto(
  invitation: Invitation,
  details: InvitationDetails | undefined,
): InvitationDto {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    projectId: invitation.projectId,
    targetType: invitation.targetType,
    targetId: invitation.targetId,
    invitedEmail: invitation.invitedEmail ?? "",
    role: invitation.role,
    status: invitation.status,
    invitedAt: invitation.invitedAt.getTime(),
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.getTime() : null,
    organizationName: details?.organizationName ?? "",
    projectName: details?.projectName ?? "",
    targetName: details?.targetName ?? "",
  }
}

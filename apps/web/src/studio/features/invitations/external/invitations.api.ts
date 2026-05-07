import {
  type InvitationDto,
  InvitationsRoutes,
  type ListInvitationsResponseDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { PendingInvitationItem, PendingInvitations } from "../invitations.models"
import type { IInvitationsSpi } from "../invitations.spi"

export default {
  acceptInvitation: async (ticketId: string) => {
    const axios = getAxiosInstance()
    await axios.post(InvitationsRoutes.acceptOne.getPath(), {
      payload: { ticketId },
    })
  },
  listPendingMine: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof InvitationsRoutes.listPendingMine.response>(
      InvitationsRoutes.listPendingMine.getPath(),
    )
    return toPendingInvitations(response.data.data)
  },
} satisfies IInvitationsSpi

const toPendingInvitationItem = (dto: InvitationDto): PendingInvitationItem => ({
  id: dto.id,
  targetType: dto.targetType,
  targetId: dto.targetId,
  organizationId: dto.organizationId,
  projectId: dto.projectId,
  role: dto.role,
  invitationToken: dto.invitationToken,
  invitedAt: dto.invitedAt,
  organizationName: dto.organizationName,
  projectName: dto.projectName,
  targetName: dto.targetName,
})

const toPendingInvitations = (dto: ListInvitationsResponseDto): PendingInvitations =>
  dto.invitations.map(toPendingInvitationItem)

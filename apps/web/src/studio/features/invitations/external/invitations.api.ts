import {
  type InvitationDto,
  InvitationsRoutes,
  type ListInvitationsResponseDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { PendingInvitation, PendingInvitations } from "../invitations.models"
import type { IInvitationsSpi } from "../invitations.spi"

export default {
  createMany: async ({ targetType, targetId, emails, role }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof InvitationsRoutes.createMany.response>(
      InvitationsRoutes.createMany.getPath(),
      { payload: { targetType, targetId, emails, role } },
    )
    return toPendingInvitations(response.data.data)
  },
  listForTarget: async ({ targetType, targetId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof InvitationsRoutes.listForTarget.response>(
      InvitationsRoutes.listForTarget.getPath(),
      { params: { targetType, targetId } },
    )
    return toPendingInvitations(response.data.data)
  },
  revokeOne: async (invitationId) => {
    const axios = getAxiosInstance()
    await axios.delete(InvitationsRoutes.revokeOne.getPath({ invitationId }))
  },
  listPendingMine: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof InvitationsRoutes.listPendingMine.response>(
      InvitationsRoutes.listPendingMine.getPath(),
    )
    return toPendingInvitations(response.data.data)
  },
  acceptOne: async (invitationId) => {
    const axios = getAxiosInstance()
    await axios.post(InvitationsRoutes.acceptOne.getPath({ invitationId }))
  },
  declineOne: async (invitationId) => {
    const axios = getAxiosInstance()
    await axios.post(InvitationsRoutes.declineOne.getPath({ invitationId }))
  },
} satisfies IInvitationsSpi

const toPendingInvitation = (dto: InvitationDto): PendingInvitation => ({
  id: dto.id,
  targetType: dto.targetType,
  targetId: dto.targetId,
  organizationId: dto.organizationId,
  projectId: dto.projectId,
  invitedEmail: dto.invitedEmail,
  role: dto.role,
  invitedAt: dto.invitedAt,
  organizationName: dto.organizationName,
  projectName: dto.projectName,
  targetName: dto.targetName,
})

const toPendingInvitations = (dto: ListInvitationsResponseDto): PendingInvitations =>
  dto.invitations.map(toPendingInvitation)

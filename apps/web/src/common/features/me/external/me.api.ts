import {
  type MeResponseDto,
  MeRoutes,
  type PendingAgentInvitationDto,
  type PendingInvitationsResponseDto,
  type PendingProjectInvitationDto,
} from "@caseai-connect/api-contracts"
import { toOrganization } from "@/common/features/organizations/external/organizations.api"
import { getAxiosInstance } from "@/external/axios"
import type {
  Me,
  PendingAgentInvitation,
  PendingInvitations,
  PendingProjectInvitation,
} from "../me.models"
import type { IMeSpi } from "../me.spi"

export default {
  getMe: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof MeRoutes.getMe.response>(MeRoutes.getMe.getPath())
    return toMe(response.data.data)
  },
  getPendingInvitations: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof MeRoutes.getPendingInvitations.response>(
      MeRoutes.getPendingInvitations.getPath(),
    )
    return toPendingInvitations(response.data.data)
  },
  acceptTerms: async ({ aiUsagePolicyAccepted }) => {
    const axios = getAxiosInstance()
    await axios.post(MeRoutes.acceptTerms.getPath(), {
      payload: { aiUsagePolicyAccepted },
    } satisfies typeof MeRoutes.acceptTerms.request)
  },
} satisfies IMeSpi

const toMe = (dto: MeResponseDto): Me => ({
  user: {
    id: dto.user.id,
    email: dto.user.email,
    name: dto.user.name,
    memberships: dto.user.memberships,
    isBackofficeAuthorized: dto.user.isBackofficeAuthorized,
    isTermsManagementAuthorized: dto.user.isTermsManagementAuthorized,
    termsAccepted: dto.user.termsAccepted,
  },
  organizations: dto.organizations.map(toOrganization),
  currentTerms: dto.currentTerms,
})

const toPendingProjectInvitation = (
  dto: PendingProjectInvitationDto,
): PendingProjectInvitation => ({
  id: dto.id,
  projectId: dto.projectId,
  projectName: dto.projectName,
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  role: dto.role,
  invitationToken: dto.invitationToken,
  createdAt: dto.createdAt,
})

const toPendingAgentInvitation = (dto: PendingAgentInvitationDto): PendingAgentInvitation => ({
  id: dto.id,
  agentId: dto.agentId,
  agentName: dto.agentName,
  projectId: dto.projectId,
  projectName: dto.projectName,
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  role: dto.role,
  invitationToken: dto.invitationToken,
  createdAt: dto.createdAt,
})

const toPendingInvitations = (dto: PendingInvitationsResponseDto): PendingInvitations => ({
  projectInvitations: dto.projectInvitations.map(toPendingProjectInvitation),
  agentInvitations: dto.agentInvitations.map(toPendingAgentInvitation),
})

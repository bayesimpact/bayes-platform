import {
  AgentInvitationsRoutes,
  type InvitationDto,
  type InvitationEmailLanguageDto,
  type ListInvitationsResponseDto,
  MyInvitationsRoutes,
  ProjectInvitationsRoutes,
  ReviewCampaignInvitationsRoutes,
} from "@caseai-connect/api-contracts"
import i18n from "i18next"
import { getAxiosInstance } from "@/external/axios"
import type { PendingInvitation, PendingInvitations } from "../invitations.models"
import type { IInvitationsSpi, ScopedInvitationTarget } from "../invitations.spi"

export default {
  createMany: async ({ emails, role, agentIds, ...target }) => {
    const axios = getAxiosInstance()
    const { routes, pathParams } = adminRoutesFor(target)
    const response = await axios.post<typeof routes.createMany.response>(
      routes.createMany.getPath(pathParams),
      // The email is written in the inviter's language: the invitee's is not known yet.
      { payload: { emails, role, agentIds, language: emailLanguage() } },
    )
    return {
      invitations: toPendingInvitations(response.data.data),
      emailSent: response.data.data.emailSent,
      grantedEmails: response.data.data.grantedEmails,
    }
  },
  listInviteeAccess: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectInvitationsRoutes.getInviteeAccess.response>(
      ProjectInvitationsRoutes.getInviteeAccess.getPath({ organizationId, projectId }),
    )
    return Object.fromEntries(
      response.data.data.members.map((member) => [
        member.email,
        { workspaceRoleKey: member.workspaceRoleKey, agentIds: member.agentIds },
      ]),
    )
  },
  listForTarget: async (target) => {
    const axios = getAxiosInstance()
    const { routes, pathParams } = adminRoutesFor(target)
    const response = await axios.get<typeof routes.getAll.response>(
      routes.getAll.getPath(pathParams),
    )
    return toPendingInvitations(response.data.data)
  },
  revokeOne: async ({ invitationId, ...target }) => {
    const axios = getAxiosInstance()
    const { routes, pathParams } = adminRoutesFor(target)
    await axios.delete(routes.deleteOne.getPath({ ...pathParams, invitationId }))
  },
  listPendingMine: async () => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof MyInvitationsRoutes.getAll.response>(
      MyInvitationsRoutes.getAll.getPath(),
    )
    return toPendingInvitations(response.data.data)
  },
  acceptOne: async (invitationId) => {
    const axios = getAxiosInstance()
    await axios.post(MyInvitationsRoutes.acceptOne.getPath({ invitationId }))
  },
  declineOne: async (invitationId) => {
    const axios = getAxiosInstance()
    await axios.post(MyInvitationsRoutes.declineOne.getPath({ invitationId }))
  },
} satisfies IInvitationsSpi

/** Each target has its own admin routes, nested under its organization and project. */
function adminRoutesFor({
  targetType,
  targetId,
  organizationId,
  projectId,
}: ScopedInvitationTarget): {
  routes:
    | typeof ProjectInvitationsRoutes
    | typeof AgentInvitationsRoutes
    | typeof ReviewCampaignInvitationsRoutes
  pathParams: Record<string, string>
} {
  switch (targetType) {
    case "project":
      return { routes: ProjectInvitationsRoutes, pathParams: { organizationId, projectId } }
    case "agent":
      return {
        routes: AgentInvitationsRoutes,
        pathParams: { organizationId, projectId, agentId: targetId },
      }
    case "review_campaign":
      return {
        routes: ReviewCampaignInvitationsRoutes,
        pathParams: { organizationId, projectId, reviewCampaignId: targetId },
      }
  }
}

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
  agents: dto.agents,
})

const toPendingInvitations = (dto: ListInvitationsResponseDto): PendingInvitations =>
  dto.invitations.map(toPendingInvitation)

function emailLanguage(): InvitationEmailLanguageDto {
  return i18n.resolvedLanguage === "fr" ? "fr" : "en"
}

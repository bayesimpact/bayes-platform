import { type AgentMembershipDto, AgentMembershipRoutes } from "@caseai-connect/api-contracts"
import { toLegacyRole } from "@/common/features/memberships/membership-roles"
import { getAxiosInstance } from "@/external/axios"
import type { AgentMembership } from "../agent-memberships.models"
import type { IAgentMembershipsSpi } from "../agent-memberships.spi"

export default {
  getAll: async ({ organizationId, projectId, agentId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentMembershipRoutes.getAll.response>(
      AgentMembershipRoutes.getAll.getPath({ organizationId, projectId, agentId }),
    )
    return response.data.data.map(fromDto)
  },
  remove: async ({ organizationId, projectId, agentId, membershipId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      AgentMembershipRoutes.deleteOne.getPath({
        organizationId,
        projectId,
        agentId,
        agentMembershipId: membershipId,
      }),
    )
  },
} satisfies IAgentMembershipsSpi

const fromDto = (dto: AgentMembershipDto): AgentMembership => ({
  id: dto.id,
  agentId: dto.agentId,
  userId: dto.userId,
  userName: dto.userName,
  userEmail: dto.userEmail,
  userHasSignedIn: dto.userHasSignedIn,
  createdAt: dto.createdAt,
  role: toLegacyRole(dto.roles) ?? "member",
})

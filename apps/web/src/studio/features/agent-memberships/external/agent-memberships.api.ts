import { type AgentMembershipDto, AgentMembershipRoutes } from "@caseai-connect/api-contracts"
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
  createdAt: dto.createdAt,
  role: dto.role,
})

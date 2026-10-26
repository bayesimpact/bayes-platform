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
  addRoles: async ({ organizationId, projectId, agentId, memberUserIds, roleKeys }) => {
    const axios = getAxiosInstance()
    const payload: typeof AgentMembershipRoutes.addRoles.request = {
      payload: { userIds: memberUserIds, roleKeys },
    }
    await axios.post(
      AgentMembershipRoutes.addRoles.getPath({ organizationId, projectId, agentId }),
      payload,
    )
  },
  removeMany: async ({ organizationId, projectId, agentId, memberUserIds }) => {
    const axios = getAxiosInstance()
    const payload: typeof AgentMembershipRoutes.deleteMany.request = {
      payload: { userIds: memberUserIds },
    }
    await axios.post(
      AgentMembershipRoutes.deleteMany.getPath({ organizationId, projectId, agentId }),
      payload,
    )
  },
} satisfies IAgentMembershipsSpi

const fromDto = (dto: AgentMembershipDto): AgentMembership => ({
  agentId: dto.agentId,
  userId: dto.userId,
  userName: dto.userName,
  userEmail: dto.userEmail,
  userHasSignedIn: dto.userHasSignedIn,
  createdAt: dto.createdAt,
  roles: dto.roles.map((role) => ({ key: role.key, name: role.name })),
})

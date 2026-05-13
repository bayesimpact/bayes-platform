import {
  type ProjectMemberAgentDto,
  type ProjectMembershipDto,
  ProjectMembershipRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ProjectMemberAgent, ProjectMembership } from "../project-memberships.models"
import type { IProjectMembershipsSpi } from "../project-memberships.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectMembershipRoutes.getAll.response>(
      ProjectMembershipRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(fromDto)
  },
  remove: async ({ organizationId, projectId, membershipId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ProjectMembershipRoutes.deleteOne.getPath({ organizationId, projectId, membershipId }),
    )
  },
  getMemberAgents: async ({ organizationId, projectId, membershipId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectMembershipRoutes.getMemberAgents.response>(
      ProjectMembershipRoutes.getMemberAgents.getPath({
        organizationId,
        projectId,
        membershipId,
      }),
    )
    return response.data.data.map(memberAgentFromDto)
  },
} satisfies IProjectMembershipsSpi

const fromDto = (dto: ProjectMembershipDto): ProjectMembership => ({
  id: dto.id,
  projectId: dto.projectId,
  userId: dto.userId,
  userName: dto.userName,
  userEmail: dto.userEmail,
  createdAt: dto.createdAt,
  role: dto.role,
})

const memberAgentFromDto = (dto: ProjectMemberAgentDto): ProjectMemberAgent => ({
  agentId: dto.agentId,
  agentName: dto.agentName,
  agentType: dto.agentType,
  membershipId: dto.membershipId,
  role: dto.role,
})

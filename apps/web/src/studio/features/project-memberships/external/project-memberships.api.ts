import {
  type ProjectMemberAgentDto,
  type ProjectMembershipDto,
  ProjectMembershipRoutes,
} from "@caseai-connect/api-contracts"
import { toLegacyRole } from "@/common/features/memberships/membership-roles"
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
  updateOne: async ({ organizationId, projectId, memberUserId, role }) => {
    const axios = getAxiosInstance()
    const payload: typeof ProjectMembershipRoutes.updateOne.request = { payload: { role } }
    const response = await axios.patch<typeof ProjectMembershipRoutes.updateOne.response>(
      ProjectMembershipRoutes.updateOne.getPath({
        organizationId,
        projectId,
        userId: memberUserId,
      }),
      payload,
    )
    return fromDto(response.data.data)
  },
  remove: async ({ organizationId, projectId, memberUserId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ProjectMembershipRoutes.deleteOne.getPath({
        organizationId,
        projectId,
        userId: memberUserId,
      }),
    )
  },
  getMemberAgents: async ({ organizationId, projectId, memberUserId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectMembershipRoutes.getMemberAgents.response>(
      ProjectMembershipRoutes.getMemberAgents.getPath({
        organizationId,
        projectId,
        userId: memberUserId,
      }),
    )
    return response.data.data.map(memberAgentFromDto)
  },
} satisfies IProjectMembershipsSpi

const fromDto = (dto: ProjectMembershipDto): ProjectMembership => ({
  projectId: dto.projectId,
  userId: dto.userId,
  userName: dto.userName,
  userEmail: dto.userEmail,
  userHasSignedIn: dto.userHasSignedIn,
  createdAt: dto.createdAt,
  role: toLegacyRole(dto.roles) ?? "member",
  permissions: dto.permissions,
})

const memberAgentFromDto = (dto: ProjectMemberAgentDto): ProjectMemberAgent => ({
  agentId: dto.agentId,
  agentName: dto.agentName,
  agentType: dto.agentType,
  role: toLegacyRole(dto.roles),
  permissions: dto.permissions,
})

import {
  AgentMembershipRoutes,
  type MemberResourceRolesDto,
  type ProjectMemberRolesDto,
  type ProjectMembershipDto,
  ProjectMembershipRoutes,
  ReviewCampaignsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { MemberResource, MemberRoles, ProjectMembership } from "../project-memberships.models"
import type { IProjectMembershipsSpi } from "../project-memberships.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectMembershipRoutes.getAll.response>(
      ProjectMembershipRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(fromDto)
  },
  getAssignableRoles: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectMembershipRoutes.getAssignableRoles.response>(
      ProjectMembershipRoutes.getAssignableRoles.getPath({ organizationId, projectId }),
    )
    return response.data.data
  },
  addRoles: async ({ organizationId, projectId, memberUserIds, roleKeys }) => {
    const axios = getAxiosInstance()
    const payload: typeof ProjectMembershipRoutes.addRoles.request = {
      payload: { userIds: memberUserIds, roleKeys },
    }
    const response = await axios.post<typeof ProjectMembershipRoutes.addRoles.response>(
      ProjectMembershipRoutes.addRoles.getPath({ organizationId, projectId }),
      payload,
    )
    return response.data.data.map(fromDto)
  },
  removeMany: async ({ organizationId, projectId, memberUserIds }) => {
    const axios = getAxiosInstance()
    const payload: typeof ProjectMembershipRoutes.deleteMany.request = {
      payload: { userIds: memberUserIds },
    }
    await axios.post(
      ProjectMembershipRoutes.deleteMany.getPath({ organizationId, projectId }),
      payload,
    )
  },
  getMemberRoles: async ({ organizationId, projectId, memberUserId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectMembershipRoutes.getMemberRoles.response>(
      ProjectMembershipRoutes.getMemberRoles.getPath({
        organizationId,
        projectId,
        userId: memberUserId,
      }),
    )
    return memberRolesFromDto(response.data.data)
  },
  removeRole: async ({ organizationId, projectId, memberUserId, roleKey }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ProjectMembershipRoutes.removeRole.getPath({
        organizationId,
        projectId,
        userId: memberUserId,
        roleKey,
      }),
    )
  },
  addAgentRole: async ({ organizationId, projectId, agentId, memberUserId, roleKey }) => {
    const axios = getAxiosInstance()
    const payload: typeof AgentMembershipRoutes.addRole.request = { payload: { roleKey } }
    await axios.post(
      AgentMembershipRoutes.addRole.getPath({
        organizationId,
        projectId,
        agentId,
        userId: memberUserId,
      }),
      payload,
    )
  },
  removeAgentRole: async ({ organizationId, projectId, agentId, memberUserId, roleKey }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      AgentMembershipRoutes.removeRole.getPath({
        organizationId,
        projectId,
        agentId,
        userId: memberUserId,
        roleKey,
      }),
    )
  },
  addCampaignRole: async ({
    organizationId,
    projectId,
    reviewCampaignId,
    memberUserId,
    roleKey,
  }) => {
    const axios = getAxiosInstance()
    const payload: typeof ReviewCampaignsRoutes.addMemberRole.request = { payload: { roleKey } }
    await axios.post(
      ReviewCampaignsRoutes.addMemberRole.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
        userId: memberUserId,
      }),
      payload,
    )
  },
  revokeCampaignRole: async ({ organizationId, projectId, reviewCampaignId, membershipId }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      ReviewCampaignsRoutes.revokeMembership.getPath({
        organizationId,
        projectId,
        reviewCampaignId,
        membershipId,
      }),
    )
  },
} satisfies IProjectMembershipsSpi

const fromDto = (dto: ProjectMembershipDto): ProjectMembership => ({
  projectId: dto.projectId,
  userId: dto.userId,
  userName: dto.userName,
  userEmail: dto.userEmail,
  userHasSignedIn: dto.userHasSignedIn,
  createdAt: dto.createdAt,
  roles: dto.roles.map((role) => ({ key: role.key, name: role.name })),
  permissions: dto.permissions,
})

const resourceFromDto = (dto: MemberResourceRolesDto): MemberResource => ({
  kind: dto.kind,
  resourceId: dto.resourceId,
  resourceName: dto.resourceName,
  detail: dto.detail,
  roles: dto.roles.map((role) => ({
    key: role.key,
    name: role.name,
    membershipId: role.membershipId,
  })),
  permissions: dto.permissions,
})

const memberRolesFromDto = (dto: ProjectMemberRolesDto): MemberRoles => ({
  member: fromDto(dto.member),
  workspace: resourceFromDto(dto.workspace),
  agents: dto.agents.map(resourceFromDto),
  campaigns: dto.campaigns.map(resourceFromDto),
})

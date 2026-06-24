import type {
  AgentMembershipRoleDto,
  BackofficeAgentDetailDto,
  BackofficeAgentListItemDto,
  BackofficeAgentMemberDto,
  BackofficeOrganizationDetailDto,
  BackofficeOrganizationDto,
  BackofficeOrganizationMemberDto,
  BackofficeOrganizationProjectDto,
  BackofficeProjectAgentDto,
  BackofficeProjectDetailDto,
  BackofficeProjectDto,
  BackofficeProjectListItemDto,
  BackofficeProjectMemberDto,
  BackofficeUserAgentMembershipDto,
  BackofficeUserDetailDto,
  BackofficeUserDto,
  BackofficeUserOrganizationMembershipDto,
  BackofficeUserProjectMembershipDto,
  BackofficeUserReviewCampaignMembershipDto,
  CurrentTermsDto,
  FeatureFlagKey,
  OrganizationMembershipRoleDto,
  PaginatedBackofficeAgentsDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeProjectsDto,
  PaginatedBackofficeUsersDto,
  ProjectMembershipRoleDto,
  ReviewCampaignMembershipRole,
  TimeType,
} from "@caseai-connect/api-contracts"

export type BackofficeProject = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagKey[]
}

export type BackofficeOrganization = {
  id: string
  name: string
  createdAt: TimeType
}

export type BackofficeOrganizationMember = {
  userId: string
  userEmail: string
  userName: string | null
  role: OrganizationMembershipRoleDto
}

export type BackofficeOrganizationProject = {
  id: string
  name: string
  featureFlags: FeatureFlagKey[]
}

export type BackofficeOrganizationDetail = {
  id: string
  name: string
  createdAt: TimeType
  members: BackofficeOrganizationMember[]
  projects: BackofficeOrganizationProject[]
}

export type BackofficeAgentListItem = {
  id: string
  name: string
  projectId: string
  projectName: string
  createdAt: TimeType
}

export type BackofficeAgentMember = {
  userId: string
  userEmail: string
  userName: string | null
  role: AgentMembershipRoleDto
}

export type BackofficeAgentDetail = {
  id: string
  name: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  members: BackofficeAgentMember[]
}

export type PaginatedBackofficeAgents = {
  agents: BackofficeAgentListItem[]
  total: number
  page: number
  limit: number
}

export const toBackofficeAgentListItem = (
  dto: BackofficeAgentListItemDto,
): BackofficeAgentListItem => ({
  id: dto.id,
  name: dto.name,
  projectId: dto.projectId,
  projectName: dto.projectName,
  createdAt: dto.createdAt,
})

export const toPaginatedBackofficeAgents = (
  dto: PaginatedBackofficeAgentsDto,
): PaginatedBackofficeAgents => ({
  agents: dto.agents.map(toBackofficeAgentListItem),
  total: dto.total,
  page: dto.page,
  limit: dto.limit,
})

const toBackofficeAgentMember = (dto: BackofficeAgentMemberDto): BackofficeAgentMember => ({
  userId: dto.userId,
  userEmail: dto.userEmail,
  userName: dto.userName,
  role: dto.role,
})

export const toBackofficeAgentDetail = (dto: BackofficeAgentDetailDto): BackofficeAgentDetail => ({
  id: dto.id,
  name: dto.name,
  projectId: dto.projectId,
  projectName: dto.projectName,
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  createdAt: dto.createdAt,
  members: dto.members.map(toBackofficeAgentMember),
})

export type BackofficeProjectListItem = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  featureFlags: FeatureFlagKey[]
}

export type BackofficeProjectMember = {
  userId: string
  userEmail: string
  userName: string | null
  role: ProjectMembershipRoleDto
}

export type BackofficeProjectAgent = {
  id: string
  name: string
}

export type BackofficeProjectDetail = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  featureFlags: FeatureFlagKey[]
  members: BackofficeProjectMember[]
  agents: BackofficeProjectAgent[]
}

export type PaginatedBackofficeProjects = {
  projects: BackofficeProjectListItem[]
  total: number
  page: number
  limit: number
}

export const toBackofficeProjectListItem = (
  dto: BackofficeProjectListItemDto,
): BackofficeProjectListItem => ({
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  createdAt: dto.createdAt,
  featureFlags: dto.featureFlags,
})

export const toPaginatedBackofficeProjects = (
  dto: PaginatedBackofficeProjectsDto,
): PaginatedBackofficeProjects => ({
  projects: dto.projects.map(toBackofficeProjectListItem),
  total: dto.total,
  page: dto.page,
  limit: dto.limit,
})

const toBackofficeProjectMember = (dto: BackofficeProjectMemberDto): BackofficeProjectMember => ({
  userId: dto.userId,
  userEmail: dto.userEmail,
  userName: dto.userName,
  role: dto.role,
})

const toBackofficeProjectAgent = (dto: BackofficeProjectAgentDto): BackofficeProjectAgent => ({
  id: dto.id,
  name: dto.name,
})

export const toBackofficeProjectDetail = (
  dto: BackofficeProjectDetailDto,
): BackofficeProjectDetail => ({
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  createdAt: dto.createdAt,
  featureFlags: dto.featureFlags,
  members: dto.members.map(toBackofficeProjectMember),
  agents: dto.agents.map(toBackofficeProjectAgent),
})

export type BackofficeUser = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
}

export type BackofficeUserOrganizationMembership = {
  organizationId: string
  organizationName: string
  role: OrganizationMembershipRoleDto
}

export type BackofficeUserProjectMembership = {
  projectId: string
  projectName: string
  role: ProjectMembershipRoleDto
}

export type BackofficeUserAgentMembership = {
  agentId: string
  agentName: string
  role: AgentMembershipRoleDto
}

export type BackofficeUserReviewCampaignMembership = {
  campaignId: string
  campaignName: string
  role: ReviewCampaignMembershipRole
}

export type BackofficeUserDetail = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
  organizationMemberships: BackofficeUserOrganizationMembership[]
  projectMemberships: BackofficeUserProjectMembership[]
  agentMemberships: BackofficeUserAgentMembership[]
  reviewCampaignMemberships: BackofficeUserReviewCampaignMembership[]
}

export const toBackofficeProject = (dto: BackofficeProjectDto): BackofficeProject => ({
  id: dto.id,
  name: dto.name,
  organizationId: dto.organizationId,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  featureFlags: dto.featureFlags,
})

export const toBackofficeOrganization = (
  dto: BackofficeOrganizationDto,
): BackofficeOrganization => ({
  id: dto.id,
  name: dto.name,
  createdAt: dto.createdAt,
})

const toBackofficeOrganizationMember = (
  dto: BackofficeOrganizationMemberDto,
): BackofficeOrganizationMember => ({
  userId: dto.userId,
  userEmail: dto.userEmail,
  userName: dto.userName,
  role: dto.role,
})

const toBackofficeOrganizationProject = (
  dto: BackofficeOrganizationProjectDto,
): BackofficeOrganizationProject => ({
  id: dto.id,
  name: dto.name,
  featureFlags: dto.featureFlags,
})

export const toBackofficeOrganizationDetail = (
  dto: BackofficeOrganizationDetailDto,
): BackofficeOrganizationDetail => ({
  id: dto.id,
  name: dto.name,
  createdAt: dto.createdAt,
  members: dto.members.map(toBackofficeOrganizationMember),
  projects: dto.projects.map(toBackofficeOrganizationProject),
})

export type PaginatedBackofficeOrganizations = {
  organizations: BackofficeOrganization[]
  total: number
  page: number
  limit: number
}

export const toPaginatedBackofficeOrganizations = (
  dto: PaginatedBackofficeOrganizationsDto,
): PaginatedBackofficeOrganizations => ({
  organizations: dto.organizations.map(toBackofficeOrganization),
  total: dto.total,
  page: dto.page,
  limit: dto.limit,
})

export const toBackofficeUser = (dto: BackofficeUserDto): BackofficeUser => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  createdAt: dto.createdAt,
})

export type PaginatedBackofficeUsers = {
  users: BackofficeUser[]
  total: number
  page: number
  limit: number
}

export const toPaginatedBackofficeUsers = (
  dto: PaginatedBackofficeUsersDto,
): PaginatedBackofficeUsers => ({
  users: dto.users.map(toBackofficeUser),
  total: dto.total,
  page: dto.page,
  limit: dto.limit,
})

const toBackofficeUserOrganizationMembership = (
  dto: BackofficeUserOrganizationMembershipDto,
): BackofficeUserOrganizationMembership => ({
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  role: dto.role,
})

const toBackofficeUserProjectMembership = (
  dto: BackofficeUserProjectMembershipDto,
): BackofficeUserProjectMembership => ({
  projectId: dto.projectId,
  projectName: dto.projectName,
  role: dto.role,
})

const toBackofficeUserAgentMembership = (
  dto: BackofficeUserAgentMembershipDto,
): BackofficeUserAgentMembership => ({
  agentId: dto.agentId,
  agentName: dto.agentName,
  role: dto.role,
})

const toBackofficeUserReviewCampaignMembership = (
  dto: BackofficeUserReviewCampaignMembershipDto,
): BackofficeUserReviewCampaignMembership => ({
  campaignId: dto.campaignId,
  campaignName: dto.campaignName,
  role: dto.role,
})

export const toBackofficeUserDetail = (dto: BackofficeUserDetailDto): BackofficeUserDetail => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  createdAt: dto.createdAt,
  organizationMemberships: dto.organizationMemberships.map(toBackofficeUserOrganizationMembership),
  projectMemberships: dto.projectMemberships.map(toBackofficeUserProjectMembership),
  agentMemberships: dto.agentMemberships.map(toBackofficeUserAgentMembership),
  reviewCampaignMemberships: dto.reviewCampaignMemberships.map(
    toBackofficeUserReviewCampaignMembership,
  ),
})

export type TermsDocuments = CurrentTermsDto

export type UpdateTermsDocumentsInput = {
  generalConditions: { url: string; version: number }
  privacyPolicy: { url: string; version: number }
  aiUsagePolicy: { url: string; version: number }
}

import type {
  AgentMembershipRoleDto,
  BackofficeOrganizationDto,
  BackofficeProjectDto,
  BackofficeUserAgentMembershipDto,
  BackofficeUserDetailDto,
  BackofficeUserDto,
  BackofficeUserOrganizationMembershipDto,
  CurrentTermsDto,
  FeatureFlagKey,
  OrganizationMembershipRoleDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeUsersDto,
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
  projects: BackofficeProject[]
}

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

export type BackofficeUserAgentMembership = {
  agentId: string
  agentName: string
  role: AgentMembershipRoleDto
}

export type BackofficeUserDetail = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
  organizationMemberships: BackofficeUserOrganizationMembership[]
  agentMemberships: BackofficeUserAgentMembership[]
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
  projects: dto.projects.map(toBackofficeProject),
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

const toBackofficeUserAgentMembership = (
  dto: BackofficeUserAgentMembershipDto,
): BackofficeUserAgentMembership => ({
  agentId: dto.agentId,
  agentName: dto.agentName,
  role: dto.role,
})

export const toBackofficeUserDetail = (dto: BackofficeUserDetailDto): BackofficeUserDetail => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  createdAt: dto.createdAt,
  organizationMemberships: dto.organizationMemberships.map(toBackofficeUserOrganizationMembership),
  agentMemberships: dto.agentMemberships.map(toBackofficeUserAgentMembership),
})

export type TermsDocuments = CurrentTermsDto

export type UpdateTermsDocumentsInput = {
  generalConditions: { url: string; version: number }
  privacyPolicy: { url: string; version: number }
  aiUsagePolicy: { url: string; version: number }
}

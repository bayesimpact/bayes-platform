import type {
  BackofficeOrganizationDto,
  BackofficeProjectDto,
  BackofficeUserDto,
  BackofficeUserOrganizationMembershipDto,
  BackofficeUserProjectMembershipDto,
  CurrentTermsDto,
  FeatureFlagKey,
  OrganizationMembershipRoleDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeUsersDto,
  ProjectMembershipRoleDto,
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

export type BackofficeUser = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
  organizationMemberships: BackofficeUserOrganizationMembership[]
  projectMemberships: BackofficeUserProjectMembership[]
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

export const toBackofficeUser = (dto: BackofficeUserDto): BackofficeUser => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  createdAt: dto.createdAt,
  organizationMemberships: dto.organizationMemberships.map(toBackofficeUserOrganizationMembership),
  projectMemberships: dto.projectMemberships.map(toBackofficeUserProjectMembership),
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

export type TermsDocuments = CurrentTermsDto

export type UpdateTermsDocumentsInput = {
  generalConditions: { url: string; version: number }
  privacyPolicy: { url: string; version: number }
  aiUsagePolicy: { url: string; version: number }
}

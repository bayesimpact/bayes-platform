import type { AgentMembershipRoleDto } from "../agent-membership/agent-membership.dto"
import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"
import type { OrganizationMembershipRoleDto } from "../organizations/organizations.dto"
import type { ProjectMembershipRoleDto } from "../project-membership/project-membership.dto"

export type BackofficeProjectDto = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
}

export type BackofficeOrganizationDto = {
  id: string
  name: string
  createdAt: TimeType
  projects: BackofficeProjectDto[]
}

export type PaginatedBackofficeOrganizationsDto = {
  organizations: BackofficeOrganizationDto[]
  total: number
  page: number
  limit: number
}

export type BackofficeProjectListItemDto = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  featureFlags: FeatureFlagsDto
}

export type PaginatedBackofficeProjectsDto = {
  projects: BackofficeProjectListItemDto[]
  total: number
  page: number
  limit: number
}

export type BackofficeProjectMemberDto = {
  userId: string
  userEmail: string
  userName: string | null
  role: ProjectMembershipRoleDto
}

export type BackofficeProjectAgentDto = {
  id: string
  name: string
}

export type BackofficeProjectDetailDto = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  featureFlags: FeatureFlagsDto
  members: BackofficeProjectMemberDto[]
  agents: BackofficeProjectAgentDto[]
}

export type BackofficeUserDto = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
}

export type PaginatedBackofficeUsersDto = {
  users: BackofficeUserDto[]
  total: number
  page: number
  limit: number
}

export type BackofficeUserOrganizationMembershipDto = {
  organizationId: string
  organizationName: string
  role: OrganizationMembershipRoleDto
}

export type BackofficeUserProjectMembershipDto = {
  projectId: string
  projectName: string
  role: ProjectMembershipRoleDto
}

export type BackofficeUserAgentMembershipDto = {
  agentId: string
  agentName: string
  role: AgentMembershipRoleDto
}

export type BackofficeUserDetailDto = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
  organizationMemberships: BackofficeUserOrganizationMembershipDto[]
  projectMemberships: BackofficeUserProjectMembershipDto[]
  agentMemberships: BackofficeUserAgentMembershipDto[]
}

export const TERMS_DOCUMENT_TYPES = [
  "general_conditions",
  "privacy_policy",
  "ai_usage_policy",
] as const
export type TermsDocumentType = (typeof TERMS_DOCUMENT_TYPES)[number]

export type TermsDocumentDto = {
  type: TermsDocumentType
  url: string
  version: number
  updatedAt: TimeType
}

export type CurrentTermsDto = {
  generalConditions: TermsDocumentDto
  privacyPolicy: TermsDocumentDto
  aiUsagePolicy: TermsDocumentDto
}

export type ListTermsDocumentsResponseDto = {
  documents: CurrentTermsDto
}

export type UpdateTermsDocumentInputDto = {
  url: string
  version: number
}

export type UpdateTermsDocumentsRequestDto = {
  generalConditions: UpdateTermsDocumentInputDto
  privacyPolicy: UpdateTermsDocumentInputDto
  aiUsagePolicy: UpdateTermsDocumentInputDto
}

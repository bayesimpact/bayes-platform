import { z } from "zod"
import type { AgentMembershipRoleDto } from "../agent-membership/agent-membership.dto"
import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"
import type { OrganizationMembershipRoleDto } from "../organizations/organizations.dto"
import type { ProjectMembershipRoleDto } from "../project-membership/project-membership.dto"
import type { ReviewCampaignMembershipRole } from "../review-campaigns/review-campaigns.dto"

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
}

export type PaginatedBackofficeOrganizationsDto = {
  organizations: BackofficeOrganizationDto[]
  total: number
  page: number
  limit: number
}

export const createBackofficeOrganizationSchema = z
  .object({
    name: z.string().min(3).max(100).trim(),
  })
  .strict()

export type CreateBackofficeOrganizationRequestDto = z.infer<
  typeof createBackofficeOrganizationSchema
>

export type BackofficeOrganizationMemberDto = {
  userId: string
  userEmail: string
  userName: string | null
  role: OrganizationMembershipRoleDto
}

export type BackofficeOrganizationProjectDto = {
  id: string
  name: string
  featureFlags: FeatureFlagsDto
}

export type BackofficeOrganizationDetailDto = {
  id: string
  name: string
  createdAt: TimeType
  members: BackofficeOrganizationMemberDto[]
  projects: BackofficeOrganizationProjectDto[]
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

export type BackofficeAgentListItemDto = {
  id: string
  name: string
  projectId: string
  projectName: string
  createdAt: TimeType
}

export type PaginatedBackofficeAgentsDto = {
  agents: BackofficeAgentListItemDto[]
  total: number
  page: number
  limit: number
}

export type BackofficeAgentMemberDto = {
  userId: string
  userEmail: string
  userName: string | null
  role: AgentMembershipRoleDto
}

export type BackofficeAgentDetailDto = {
  id: string
  name: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  members: BackofficeAgentMemberDto[]
  /** The people granted to read any conversation of this agent for safety review. */
  conversationReviewers: BackofficeAgentConversationReviewerDto[]
}

export type BackofficeAgentConversationReviewerDto = {
  userId: string
  email: string
  name: string | null
  grantedAt: TimeType
}

export const grantBackofficeAgentConversationReviewerSchema = z.object({
  email: z.string().trim().email(),
})

export type GrantBackofficeAgentConversationReviewerRequestDto = z.infer<
  typeof grantBackofficeAgentConversationReviewerSchema
>

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

export type BackofficeRoleScopeDto = "organization" | "project" | "agent" | "global"

export type BackofficeRbacPermissionDto = {
  key: string
  description: string
}

export type BackofficeRbacRoleDto = {
  key: string
  name: string
  scopeType: BackofficeRoleScopeDto
  permissions: string[]
}

export type BackofficeRbacCatalogDto = {
  roles: BackofficeRbacRoleDto[]
  permissions: BackofficeRbacPermissionDto[]
}

export type BackofficeUserGlobalRoleDto = {
  key: string
  name: string
  permissions: string[]
}

export type BackofficeUserOrganizationMembershipDto = {
  organizationId: string
  organizationName: string
  role: OrganizationMembershipRoleDto
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserProjectMembershipDto = {
  projectId: string
  projectName: string
  role: ProjectMembershipRoleDto
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserAgentMembershipDto = {
  agentId: string
  agentName: string
  role: AgentMembershipRoleDto
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserReviewCampaignMembershipDto = {
  campaignId: string
  campaignName: string
  role: ReviewCampaignMembershipRole
}

export type BackofficeUserDetailDto = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
  globalRoles: BackofficeUserGlobalRoleDto[]
  organizationMemberships: BackofficeUserOrganizationMembershipDto[]
  projectMemberships: BackofficeUserProjectMembershipDto[]
  agentMemberships: BackofficeUserAgentMembershipDto[]
  reviewCampaignMemberships: BackofficeUserReviewCampaignMembershipDto[]
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

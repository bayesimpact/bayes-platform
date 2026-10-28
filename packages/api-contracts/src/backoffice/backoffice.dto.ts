import { z } from "zod"
import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"
import type { MembershipRoleDto, RoleScopeTypeDto } from "../rbac/membership-role.dto"

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
  roles: MembershipRoleDto[]
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
  permissions: string[]
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
  roles: MembershipRoleDto[]
}

export type BackofficeProjectAgentDto = {
  id: string
  name: string
  permissions: string[]
}

export type BackofficeProjectOrganizationDto = {
  id: string
  name: string
  permissions: string[]
}

export type BackofficeProjectDetailDto = {
  id: string
  name: string
  organization: BackofficeProjectOrganizationDto
  createdAt: TimeType
  featureFlags: FeatureFlagsDto
  permissions: string[]
  /** Only the members the caller may read. */
  members: BackofficeProjectMemberDto[]
  /** How many members the caller may not read, left out of `members`. */
  hiddenMemberCount: number
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
  roles: MembershipRoleDto[]
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
  /** The user's global roles, by key: none for most users. */
  globalRoles: BackofficeUserGlobalRoleSummaryDto[]
}

export type BackofficeUserGlobalRoleSummaryDto = {
  key: string
  name: string
}

export type PaginatedBackofficeUsersDto = {
  users: BackofficeUserDto[]
  total: number
  page: number
  limit: number
}

export type BackofficeRoleScopeDto = RoleScopeTypeDto

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

/** The global roles a superadmin grants or revokes from the backoffice user page. */
export const BACKOFFICE_GLOBAL_ROLE_KEYS = [
  "platform_superadmin",
  "platform_staff",
  "platform_org_creator",
] as const

export type BackofficeGlobalRoleKey = (typeof BACKOFFICE_GLOBAL_ROLE_KEYS)[number]

export const grantBackofficeUserGlobalRoleSchema = z.object({
  roleKey: z.enum(BACKOFFICE_GLOBAL_ROLE_KEYS),
})

export type GrantBackofficeUserGlobalRoleRequestDto = z.infer<
  typeof grantBackofficeUserGlobalRoleSchema
>

export type BackofficeUserGlobalRoleDto = {
  key: string
  name: string
  permissions: string[]
}

export type BackofficeUserOrganizationMembershipDto = {
  organizationId: string
  organizationName: string
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant, together. */
  permissions: string[]
}

export type BackofficeUserProjectMembershipDto = {
  projectId: string
  projectName: string
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant, together. */
  permissions: string[]
}

export type BackofficeUserAgentMembershipDto = {
  agentId: string
  agentName: string
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant, together. */
  permissions: string[]
}

export type BackofficeUserReviewCampaignMembershipDto = {
  campaignId: string
  campaignName: string
  projectId: string
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant, together. */
  permissions: string[]
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

/** Where the last run of a maintenance job stands, as BullMQ reports it. */
export type BackofficeMaintenanceJobRunState = "waiting" | "active" | "completed" | "failed"

export type BackofficeMaintenanceJobRunDto = {
  state: BackofficeMaintenanceJobRunState
  requestedAt: TimeType
  finishedAt: TimeType | null
  /** Items handled so far out of the total, while the run is active or once it is done. */
  progress: { done: number; total: number } | null
  /** What the run did, written by the job when it ends. */
  summary: string | null
  error: string | null
}

/**
 * A one-off maintenance job: a data migration run in the workers across every organization.
 * It is removed from the code once it has nothing left to do on every platform.
 */
export type BackofficeMaintenanceJobDto = {
  key: string
  title: string
  description: string
  /** How many items the job still has to handle. Zero means there is nothing left to run. */
  remainingCount: number
  /** The same, in words, e.g. "3 web crawls in 2 projects". */
  remainingSummary: string
  lastRun: BackofficeMaintenanceJobRunDto | null
}

export type ListBackofficeMaintenanceJobsResponseDto = {
  jobs: BackofficeMaintenanceJobDto[]
}

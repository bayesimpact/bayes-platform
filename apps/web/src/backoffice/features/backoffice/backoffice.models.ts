import type {
  AppGrantablePermission,
  AppManifestDto,
  BackofficeAgentDetailDto,
  BackofficeAgentListItemDto,
  BackofficeAgentMemberDto,
  BackofficeMaintenanceJobDto,
  BackofficeOrganizationDetailDto,
  BackofficeOrganizationDto,
  BackofficeOrganizationMemberDto,
  BackofficeOrganizationProjectDto,
  BackofficeProjectAgentDto,
  BackofficeProjectDetailDto,
  BackofficeProjectDto,
  BackofficeProjectListItemDto,
  BackofficeProjectMemberDto,
  BackofficeRbacCatalogDto,
  BackofficeRbacPermissionDto,
  BackofficeRbacRoleDto,
  BackofficeRoleScopeDto,
  BackofficeUserAgentMembershipDto,
  BackofficeUserDetailDto,
  BackofficeUserDto,
  BackofficeUserGlobalRoleDto,
  BackofficeUserOrganizationMembershipDto,
  BackofficeUserProjectMembershipDto,
  BackofficeUserReviewCampaignMembershipDto,
  CurrentTermsDto,
  FeatureFlagKey,
  MembershipRoleDto,
  PaginatedBackofficeAgentsDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeProjectsDto,
  PaginatedBackofficeUsersDto,
  ReviewCampaignMembershipRole,
  TimeType,
} from "@caseai-connect/api-contracts"
import {
  type LegacyMembershipRole,
  toLegacyRole,
} from "@/common/features/memberships/membership-roles"

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
  role: LegacyMembershipRole
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
  role: LegacyMembershipRole
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
  /** The people granted to read any conversation of this agent for safety review. */
  conversationReviewers: BackofficeAgentConversationReviewer[]
}

export type BackofficeAgentConversationReviewer = {
  userId: string
  email: string
  name: string | null
  grantedAt: TimeType
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
  role: toLegacyRole(dto.roles) ?? "member",
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
  conversationReviewers: dto.conversationReviewers.map((reviewer) => ({
    userId: reviewer.userId,
    email: reviewer.email,
    name: reviewer.name,
    grantedAt: reviewer.grantedAt,
  })),
})

export type BackofficeProjectListItem = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  createdAt: TimeType
  featureFlags: FeatureFlagKey[]
  permissions: string[]
}

export type BackofficeProjectMember = {
  userId: string
  userEmail: string
  userName: string | null
  role: LegacyMembershipRole
  canRead: boolean
}

export type BackofficeProjectAgent = {
  id: string
  name: string
  permissions: string[]
}

export type BackofficeProjectOrganization = {
  id: string
  name: string
  permissions: string[]
}

export type BackofficeProjectDetail = {
  id: string
  name: string
  organization: BackofficeProjectOrganization
  createdAt: TimeType
  featureFlags: FeatureFlagKey[]
  permissions: string[]
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
  permissions: dto.permissions,
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
  role: toLegacyRole(dto.roles) ?? "member",
  canRead: dto.canRead,
})

const toBackofficeProjectAgent = (dto: BackofficeProjectAgentDto): BackofficeProjectAgent => ({
  id: dto.id,
  name: dto.name,
  permissions: dto.permissions,
})

export const toBackofficeProjectDetail = (
  dto: BackofficeProjectDetailDto,
): BackofficeProjectDetail => ({
  id: dto.id,
  name: dto.name,
  organization: {
    id: dto.organization.id,
    name: dto.organization.name,
    permissions: dto.organization.permissions,
  },
  createdAt: dto.createdAt,
  featureFlags: dto.featureFlags,
  permissions: dto.permissions,
  members: dto.members.map(toBackofficeProjectMember),
  agents: dto.agents.map(toBackofficeProjectAgent),
})

export type BackofficeUser = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
}

export type BackofficeUserGlobalRole = {
  key: string
  name: string
  permissions: string[]
}

export type BackofficeUserOrganizationMembership = {
  organizationId: string
  organizationName: string
  role: LegacyMembershipRole
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserProjectMembership = {
  projectId: string
  projectName: string
  role: LegacyMembershipRole
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserAgentMembership = {
  agentId: string
  agentName: string
  role: LegacyMembershipRole
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserReviewCampaignMembership = {
  campaignId: string
  campaignName: string
  projectId: string
  role: ReviewCampaignMembershipRole
  /** The `review_campaign_*` RBAC roles, comma-separated. */
  roleKey: string | null
  permissions: string[]
}

export type BackofficeUserDetail = {
  id: string
  email: string
  name: string | null
  createdAt: TimeType
  globalRoles: BackofficeUserGlobalRole[]
  organizationMemberships: BackofficeUserOrganizationMembership[]
  projectMemberships: BackofficeUserProjectMembership[]
  agentMemberships: BackofficeUserAgentMembership[]
  reviewCampaignMemberships: BackofficeUserReviewCampaignMembership[]
}

export type BackofficeRbacPermission = {
  key: string
  description: string
}

export type BackofficeRbacRole = {
  key: string
  name: string
  scopeType: BackofficeRoleScopeDto
  permissions: string[]
}

export type BackofficeRbacCatalog = {
  roles: BackofficeRbacRole[]
  permissions: BackofficeRbacPermission[]
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
  role: toLegacyRole(dto.roles) ?? "member",
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

/** The catalog keys of the roles, comma-separated, or null without one. */
const toRoleKeys = (roles: MembershipRoleDto[]): string | null =>
  roles.length > 0 ? roles.map((role) => role.key).join(", ") : null

const toBackofficeUserOrganizationMembership = (
  dto: BackofficeUserOrganizationMembershipDto,
): BackofficeUserOrganizationMembership => ({
  organizationId: dto.organizationId,
  organizationName: dto.organizationName,
  role: toLegacyRole(dto.roles) ?? "member",
  roleKey: toRoleKeys(dto.roles),
  permissions: dto.permissions,
})

const toBackofficeUserProjectMembership = (
  dto: BackofficeUserProjectMembershipDto,
): BackofficeUserProjectMembership => ({
  projectId: dto.projectId,
  projectName: dto.projectName,
  role: toLegacyRole(dto.roles) ?? "member",
  roleKey: toRoleKeys(dto.roles),
  permissions: dto.permissions,
})

const toBackofficeUserAgentMembership = (
  dto: BackofficeUserAgentMembershipDto,
): BackofficeUserAgentMembership => ({
  agentId: dto.agentId,
  agentName: dto.agentName,
  role: toLegacyRole(dto.roles) ?? "member",
  roleKey: toRoleKeys(dto.roles),
  permissions: dto.permissions,
})

const toBackofficeUserReviewCampaignMembership = (
  dto: BackofficeUserReviewCampaignMembershipDto,
): BackofficeUserReviewCampaignMembership => ({
  campaignId: dto.campaignId,
  campaignName: dto.campaignName,
  projectId: dto.projectId,
  role: dto.roles.some((role) => role.key === "review_campaign_tester") ? "tester" : "reviewer",
  roleKey: toRoleKeys(dto.roles),
  permissions: dto.permissions,
})

const toBackofficeUserGlobalRole = (
  dto: BackofficeUserGlobalRoleDto,
): BackofficeUserGlobalRole => ({
  key: dto.key,
  name: dto.name,
  permissions: dto.permissions,
})

export const toBackofficeUserDetail = (dto: BackofficeUserDetailDto): BackofficeUserDetail => ({
  id: dto.id,
  email: dto.email,
  name: dto.name,
  createdAt: dto.createdAt,
  globalRoles: dto.globalRoles.map(toBackofficeUserGlobalRole),
  organizationMemberships: dto.organizationMemberships.map(toBackofficeUserOrganizationMembership),
  projectMemberships: dto.projectMemberships.map(toBackofficeUserProjectMembership),
  agentMemberships: dto.agentMemberships.map(toBackofficeUserAgentMembership),
  reviewCampaignMemberships: dto.reviewCampaignMemberships.map(
    toBackofficeUserReviewCampaignMembership,
  ),
})

const toBackofficeRbacPermission = (
  dto: BackofficeRbacPermissionDto,
): BackofficeRbacPermission => ({
  key: dto.key,
  description: dto.description,
})

const toBackofficeRbacRole = (dto: BackofficeRbacRoleDto): BackofficeRbacRole => ({
  key: dto.key,
  name: dto.name,
  scopeType: dto.scopeType,
  permissions: dto.permissions,
})

export const toBackofficeRbacCatalog = (dto: BackofficeRbacCatalogDto): BackofficeRbacCatalog => ({
  roles: dto.roles.map(toBackofficeRbacRole),
  permissions: dto.permissions.map(toBackofficeRbacPermission),
})

export type TermsDocuments = CurrentTermsDto

export type UpdateTermsDocumentsInput = {
  generalConditions: { url: string; version: number }
  privacyPolicy: { url: string; version: number }
  aiUsagePolicy: { url: string; version: number }
}

export type AppManifest = {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  grantablePermissions: AppGrantablePermission[]
  allowedRedirectUris: string[]
  createdAt: TimeType
}

export type CreateAppManifestInput = {
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  grantablePermissions: AppGrantablePermission[]
  allowedRedirectUris?: string[]
}

export type UpdateAppManifestInput = Partial<CreateAppManifestInput>

/** The OAuth client an app signs in with (ADR 0029). Null until its first secret. */
export type AppOAuthClient = {
  clientId: string | null
  issuer: string
  authorizationEndpoint: string
  resource: string
}

/** A new secret, shown once: only its hash is kept. */
export type AppOAuthClientSecret = {
  clientId: string
  clientSecret: string
}

export const toAppManifest = (dto: AppManifestDto): AppManifest => ({
  id: dto.id,
  name: dto.name,
  slug: dto.slug,
  description: dto.description,
  logoUrl: dto.logoUrl,
  grantablePermissions: dto.grantablePermissions,
  allowedRedirectUris: dto.allowedRedirectUris,
  createdAt: dto.createdAt,
})

export type MaintenanceJobRunState = "waiting" | "active" | "completed" | "failed"

export type MaintenanceJobRun = {
  state: MaintenanceJobRunState
  requestedAt: TimeType
  finishedAt: TimeType | null
  progress: { done: number; total: number } | null
  summary: string | null
  error: string | null
}

/** A one-off data migration the workers run across every organization. */
export type MaintenanceJob = {
  key: string
  title: string
  description: string
  remainingCount: number
  remainingSummary: string
  lastRun: MaintenanceJobRun | null
}

export const toMaintenanceJob = (dto: BackofficeMaintenanceJobDto): MaintenanceJob => ({
  key: dto.key,
  title: dto.title,
  description: dto.description,
  remainingCount: dto.remainingCount,
  remainingSummary: dto.remainingSummary,
  lastRun: dto.lastRun,
})

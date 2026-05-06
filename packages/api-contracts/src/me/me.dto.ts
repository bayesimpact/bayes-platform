import type {
  AgentMembershipDto,
  AgentMembershipRoleDto,
} from "../agent-membership/agent-membership.dto"
import type { CurrentTermsDto } from "../backoffice/backoffice.dto"
import type { TimeType } from "../generic"
import type { OrganizationDto, OrganizationMembershipDto } from "../organizations/organizations.dto"
import type {
  ProjectMembershipDto,
  ProjectMembershipRoleDto,
} from "../project-membership/project-membership.dto"
import type {
  ReviewCampaignMembershipRole,
  ReviewCampaignStatus,
} from "../review-campaigns/review-campaigns.dto"

export type ReviewCampaignMembershipForMeDto = {
  id: string
  campaignId: string
  organizationId: string
  projectId: string
  role: ReviewCampaignMembershipRole
  campaignStatus: ReviewCampaignStatus
}

export type UserMembershipsDto = {
  organizationMemberships: Pick<OrganizationMembershipDto, "id" | "organizationId" | "role">[]
  projectMemberships: Pick<ProjectMembershipDto, "id" | "projectId" | "role">[]
  agentMemberships: Pick<AgentMembershipDto, "id" | "agentId" | "role">[]
  reviewCampaignMemberships: ReviewCampaignMembershipForMeDto[]
}

export type UserDto = {
  id: string
  email: string
  name: string
  memberships: UserMembershipsDto
  isBackofficeAuthorized: boolean
  isTermsManagementAuthorized: boolean
  termsAccepted: boolean
}

export type MeResponseDto = {
  user: UserDto
  organizations: OrganizationDto[]
  currentTerms: CurrentTermsDto
}

export type PendingProjectInvitationDto = {
  id: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  role: ProjectMembershipRoleDto
  invitationToken: string
  createdAt: TimeType
}

export type PendingAgentInvitationDto = {
  id: string
  agentId: string
  agentName: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  role: AgentMembershipRoleDto
  invitationToken: string
  createdAt: TimeType
}

export type PendingInvitationsResponseDto = {
  projectInvitations: PendingProjectInvitationDto[]
  agentInvitations: PendingAgentInvitationDto[]
}

export function buildNameFromEmail(email: string): string {
  return email.split("@")[0]?.replaceAll(".", " ") ?? "Unnamed User"
}

export type TermsAcceptanceDto = {
  id: string
  createdAt: TimeType
  generalConditionsUrl: string
  generalConditionsVersion: number
  privacyPolicyUrl: string
  privacyPolicyVersion: number
  aiUsagePolicyUrl: string
  aiUsagePolicyVersion: number
  aiUsagePolicyAccepted: boolean
}

export type AcceptTermsRequestDto = {
  aiUsagePolicyAccepted: boolean
}

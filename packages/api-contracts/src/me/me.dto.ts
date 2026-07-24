import { z } from "zod"
import type { AgentMembershipDto } from "../agent-membership/agent-membership.dto"
import type { CurrentTermsDto } from "../backoffice/backoffice.dto"
import type { TimeType } from "../generic"
import type { OrganizationDto, OrganizationMembershipDto } from "../organizations/organizations.dto"
import type { ProjectMembershipDto } from "../project-membership/project-membership.dto"
import type { GlobalPermission } from "../rbac/permissions"
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
  globalPermissions: GlobalPermission[]
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

export function buildNameFromEmail(email: string): string {
  return email.split("@")[0]?.replaceAll(".", " ") ?? "Unnamed User"
}

export type TermsAcceptanceDto = {
  id: string
  createdAt: TimeType
  generalConditionsVersion: number
  privacyPolicyVersion: number
  aiUsagePolicyVersion: number
  aiUsagePolicyAccepted: boolean
}

export type AcceptTermsRequestDto = {
  aiUsagePolicyAccepted: boolean
}

export const updateMeSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

export type UpdateMeRequestDto = z.infer<typeof updateMeSchema>

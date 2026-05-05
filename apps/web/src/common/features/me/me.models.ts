import type {
  AgentMembershipRoleDto,
  CurrentTermsDto,
  ProjectMembershipRoleDto,
  TermsDocumentDto,
  UserMembershipsDto,
} from "@caseai-connect/api-contracts"
import type { Organization } from "@/common/features/organizations/organizations.models"

export type User = {
  id: string
  email: string
  name: string
  memberships: UserMembershipsDto
  isBackofficeAuthorized: boolean
  isTermsManagementAuthorized: boolean
  termsAccepted: boolean
}

export type TermsDocument = TermsDocumentDto
export type CurrentTerms = CurrentTermsDto

export type Me = {
  user: User
  organizations: Organization[]
  currentTerms: CurrentTerms
}

export type PendingProjectInvitation = {
  id: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  role: ProjectMembershipRoleDto
  invitationToken: string
  createdAt: number
}

export type PendingAgentInvitation = {
  id: string
  agentId: string
  agentName: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  role: AgentMembershipRoleDto
  invitationToken: string
  createdAt: number
}

export type PendingInvitations = {
  projectInvitations: PendingProjectInvitation[]
  agentInvitations: PendingAgentInvitation[]
}

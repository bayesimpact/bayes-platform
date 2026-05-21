import type {
  AgentMembershipRoleDto,
  CurrentTermsDto,
  OrganizationMembershipRoleDto,
  ProjectMembershipRoleDto,
  TermsDocumentDto,
  UserMembershipsDto,
} from "@caseai-connect/api-contracts"
import type { Organization } from "@/common/features/organizations/organizations.models"

type Role = OrganizationMembershipRoleDto | ProjectMembershipRoleDto | AgentMembershipRoleDto
export const ROLES = ["owner", "admin", "member"] as Role[]
export const SUPER_ROLES = ["owner", "admin"] as Role[]
export type ROLE = (typeof ROLES)[number]

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

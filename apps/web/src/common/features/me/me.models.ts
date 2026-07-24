import type {
  AgentMembershipRoleDto,
  CurrentTermsDto,
  GlobalPermission,
  OrganizationMembershipRoleDto,
  ProjectMembershipRoleDto,
  TermsDocumentDto,
  UserMembershipsDto,
} from "@caseai-connect/api-contracts"

type Role = OrganizationMembershipRoleDto | ProjectMembershipRoleDto | AgentMembershipRoleDto
export const ROLES = ["owner", "admin", "member"] as Role[]
export const SUPER_ROLES = ["owner", "admin"] as Role[]
export type ROLE = (typeof ROLES)[number]

export type User = {
  id: string
  email: string
  name: string
  globalPermissions: GlobalPermission[]
  memberships: UserMembershipsDto
  isBackofficeAuthorized: boolean
  isTermsManagementAuthorized: boolean
  termsAccepted: boolean
}

export type TermsDocument = TermsDocumentDto
export type CurrentTerms = CurrentTermsDto

export type Me = {
  user: User
  currentTerms: CurrentTerms
}

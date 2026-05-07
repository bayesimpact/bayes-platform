import type {
  CurrentTermsDto,
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

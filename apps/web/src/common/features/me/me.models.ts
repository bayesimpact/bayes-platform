import type {
  CurrentTermsDto,
  GlobalPermission,
  TermsDocumentDto,
} from "@caseai-connect/api-contracts"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"

type Role = LegacyMembershipRole
export const ROLES = ["owner", "admin", "member"] as Role[]
export const SUPER_ROLES = ["owner", "admin"] as Role[]
export type ROLE = (typeof ROLES)[number]

export type User = {
  id: string
  email: string
  name: string
  globalPermissions: GlobalPermission[]
  /** The agents whose conversations this user was granted to read for safety review. */
  conversationReviewAgentIds: string[]
  termsAccepted: boolean
}

export type TermsDocument = TermsDocumentDto
export type CurrentTerms = CurrentTermsDto

export type Me = {
  user: User
  currentTerms: CurrentTerms
}

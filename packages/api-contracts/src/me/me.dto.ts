import { z } from "zod"
import type { CurrentTermsDto } from "../backoffice/backoffice.dto"
import type { TimeType } from "../generic"
import type { OrganizationDto } from "../organizations/organizations.dto"
import type { GlobalPermission } from "../rbac/permissions"

export type UserDto = {
  id: string
  email: string
  name: string
  globalPermissions: GlobalPermission[]
  /** The agents whose conversations this user was granted to read for safety review. */
  conversationReviewAgentIds: string[]
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

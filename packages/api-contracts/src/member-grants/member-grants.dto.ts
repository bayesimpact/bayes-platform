export type MemberGrantTargetTypeDto = "project" | "agent" | "review_campaign"

/**
 * Gives access to a resource by email. Access is granted right away: an
 * unknown email gets an account that is linked to the person's identity
 * provider login the first time they sign in.
 */
export type CreateMemberGrantsRequestDto = {
  targetType: MemberGrantTargetTypeDto
  targetId: string
  emails: string[]
  role?: string
}

export type CreateMemberGrantsResponseDto = {
  /** Normalized emails that received access. Skipped emails (already members, service identities) are left out. */
  grantedEmails: string[]
}

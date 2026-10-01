export type MemberGrantTargetType = "project" | "agent" | "review_campaign"

/** People added by email get access right away; they sign in with their organization's account. */
export type MemberGrantResult = {
  /** Emails that received access. Existing members are left out. */
  grantedEmails: string[]
}

import {
  REVIEW_CAMPAIGN_ROLE_KEYS,
  type ReviewCampaignMembershipOutputDto,
  type ReviewCampaignRoleDto,
} from "@bayes-platform/eval-contracts"

/** One role of one person in a campaign: a row of the participants' table. */
export type Participant = {
  membershipId: string
  email: string
  role: ReviewCampaignRoleDto
  hasSignedIn: boolean
}

/**
 * The participants of a campaign, one row per role: a person who tests and reviews has two, each
 * revoked on its own. Sorted by email, then testers first.
 */
export function listParticipants(memberships: ReviewCampaignMembershipOutputDto[]): Participant[] {
  return memberships
    .flatMap((membership) =>
      membership.roles.flatMap((role): Participant[] => {
        // `in` would also match the keys every object inherits, such as `constructor`.
        if (!Object.hasOwn(REVIEW_CAMPAIGN_ROLE_KEYS, role.key)) return []
        return [
          {
            membershipId: role.membershipId,
            email: membership.userEmail,
            // Safe: `Object.hasOwn` just found the key among the object's own keys.
            role: REVIEW_CAMPAIGN_ROLE_KEYS[role.key as keyof typeof REVIEW_CAMPAIGN_ROLE_KEYS],
            hasSignedIn: membership.userHasSignedIn,
          },
        ]
      }),
    )
    .sort(
      (first, second) =>
        first.email.localeCompare(second.email) || second.role.localeCompare(first.role),
    )
}

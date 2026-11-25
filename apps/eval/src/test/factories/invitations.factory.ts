import { type InvitationOutputDto, invitationOutputSchema } from "@bayes-platform/eval-contracts"
import { daysAgo } from "./review-campaigns.factory"

/**
 * A pending invitation the person received, to test a review campaign by default, checked against
 * the contract.
 */
export function buildInvitation(overrides: Partial<InvitationOutputDto> = {}): InvitationOutputDto {
  return invitationOutputSchema.parse({
    id: crypto.randomUUID(),
    organizationName: "Product",
    projectName: "Support",
    targetType: "review_campaign",
    targetName: "Support assistant pilot",
    role: "tester",
    status: "pending",
    invitedAt: daysAgo(1),
    ...overrides,
  })
}

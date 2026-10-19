import { ForbiddenException } from "@nestjs/common"
import type { ReviewCampaign } from "./review-campaign.entity"
import type { ReviewCampaignStatus } from "./review-campaigns.types"

// RBAC says who takes part in a campaign. The campaign status says what they can still do there:
// testing and reviewing need an active campaign, reading what it holds needs it activated.

export function assertReviewCampaignIsActive(campaign: ReviewCampaign): void {
  assertReviewCampaignStatus(campaign, ["active"])
}

export function assertReviewCampaignIsNotDraft(campaign: ReviewCampaign): void {
  assertReviewCampaignStatus(campaign, ["active", "closed"])
}

export const reviewCampaignStatusErrorMessage = (status: ReviewCampaignStatus): string =>
  `This action is not available on a ${status} campaign`

function assertReviewCampaignStatus(
  campaign: ReviewCampaign,
  allowedStatuses: readonly ReviewCampaignStatus[],
): void {
  if (!allowedStatuses.includes(campaign.status)) {
    throw new ForbiddenException(reviewCampaignStatusErrorMessage(campaign.status))
  }
}

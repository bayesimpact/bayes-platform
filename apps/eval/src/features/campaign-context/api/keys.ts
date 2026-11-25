import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"

export const campaignContextKeys = {
  all: ["campaign-contexts"] as const,
  detail: (campaign: ReviewCampaignParamsDto) =>
    [...campaignContextKeys.all, campaign.reviewCampaignId] as const,
}

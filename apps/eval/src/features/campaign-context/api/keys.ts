import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"

export const campaignContextKeys = {
  all: ["campaign-contexts"] as const,
  detail: (campaign: ReviewCampaignParamsDto) =>
    [...campaignContextKeys.all, campaign.reviewCampaignId] as const,
}

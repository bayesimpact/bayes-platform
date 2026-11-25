import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"

export const campaignTestKeys = {
  all: ["campaign-tests"] as const,
  sessions: (campaign: ReviewCampaignParamsDto) =>
    [...campaignTestKeys.all, "sessions", campaign.reviewCampaignId] as const,
  survey: (campaign: ReviewCampaignParamsDto) =>
    [...campaignTestKeys.all, "survey", campaign.reviewCampaignId] as const,
}

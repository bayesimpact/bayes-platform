import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"

export const campaignTestKeys = {
  all: ["campaign-tests"] as const,
  sessions: (campaign: ReviewCampaignParamsDto) =>
    [...campaignTestKeys.all, "sessions", campaign.reviewCampaignId] as const,
  survey: (campaign: ReviewCampaignParamsDto) =>
    [...campaignTestKeys.all, "survey", campaign.reviewCampaignId] as const,
}

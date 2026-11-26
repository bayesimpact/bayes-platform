import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"

export const campaignReportKeys = {
  all: ["campaign-reports"] as const,
  detail: (campaign: ReviewCampaignParamsDto) =>
    [...campaignReportKeys.all, campaign.reviewCampaignId] as const,
}

import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"

export const campaignReportKeys = {
  all: ["campaign-reports"] as const,
  detail: (campaign: ReviewCampaignParamsDto) =>
    [...campaignReportKeys.all, campaign.reviewCampaignId] as const,
}

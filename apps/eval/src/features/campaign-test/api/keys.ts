import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { CAMPAIGN_TEST_QUERY_KEY, TESTER_SESSIONS_QUERY_KEY } from "@/lib/tester-session-keys"

export const campaignTestKeys = {
  all: CAMPAIGN_TEST_QUERY_KEY,
  sessions: (campaign: ReviewCampaignParamsDto) =>
    [...TESTER_SESSIONS_QUERY_KEY, campaign.reviewCampaignId] as const,
  survey: (campaign: ReviewCampaignParamsDto) =>
    [...campaignTestKeys.all, "survey", campaign.reviewCampaignId] as const,
}

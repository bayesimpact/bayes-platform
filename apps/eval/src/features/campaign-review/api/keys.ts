import type {
  CampaignSessionParamsDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"

export const campaignReviewKeys = {
  all: ["campaign-reviews"] as const,
  sessions: (campaign: ReviewCampaignParamsDto) =>
    [...campaignReviewKeys.all, "sessions", campaign.reviewCampaignId] as const,
  session: (session: CampaignSessionParamsDto) =>
    [...campaignReviewKeys.all, "session", session.sessionId] as const,
  mcpAppsHtml: (session: CampaignSessionParamsDto) =>
    [...campaignReviewKeys.session(session), "mcp-apps"] as const,
}

import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/reviewer")
const campaignBase = home.extend(
  "/o/:organizationId/p/:projectId/review-campaigns/:reviewCampaignId",
)
const campaign = campaignBase // alias for clarity at call sites
const report = campaignBase.extend("/report")
const session = campaignBase.extend("/sessions/:sessionId")

export const ReviewerRoutes = { home, campaign, report, session }

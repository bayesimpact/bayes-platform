import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/tester")
const campaignBase = home.extend(
  "/o/:organizationId/p/:projectId/review-campaigns/:reviewCampaignId",
)
const campaign = campaignBase // alias for clarity at call sites
const survey = campaignBase.extend("/survey")
const session = campaignBase.extend("/a/:agentId/as/:agentSessionId")

export const TesterRoutes = { home, campaign, survey, session }

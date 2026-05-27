import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/reviewer")
const campaign = home.extend("/o/:organizationId/p/:projectId/review-campaigns/:reviewCampaignId")
const report = campaign.extend("/report")
const session = campaign.extend("/sessions/:agentSessionId")

export const ReviewerRoutes = { home, campaign, report, session }

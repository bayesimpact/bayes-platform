import { defineRoute } from "@/common/routes/helpers"
import { getAppPathname } from "@/config/runtime-config"

const home = defineRoute("/tester")
const campaign = home.extend("/o/:organizationId/p/:projectId/review-campaigns/:reviewCampaignId")
const survey = campaign.extend("/survey")
const session = campaign.extend("/a/:agentId/as/:agentSessionId")

export const TesterRoutes = { home, campaign, survey, session }

export const isTesterInterface = () => getAppPathname().startsWith(TesterRoutes.home.path)

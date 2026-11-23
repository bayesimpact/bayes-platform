import { defineRoute } from "./helpers"

const project = defineRoute("/eval/o/:organizationId/p/:projectId")
const campaign = project.extend("/review-campaigns/:reviewCampaignId")

/**
 * Pages of the Evaluation app (apps/eval), an app of its own served at `/eval`: a link to one
 * leaves this app with a full page load, never through its router.
 */
export const EvalRoutes = {
  // The app's home: it opens the person's last agent, or the first campaign they test or review.
  home: defineRoute("/eval/"),
  project,
  // Project URLs of the former evaluation pages: the app opens them under an agent of the project.
  conversation: project.extend("/conversation"),
  extraction: project.extend("/extraction"),
  // A campaign for the people who test it, then for those who review it.
  testerCampaign: campaign.extend("/test"),
  testerSurvey: campaign.extend("/test/survey"),
  testerSession: campaign.extend("/test/sessions/:agentSessionId"),
  reviewerCampaign: campaign.extend("/review"),
  reviewerReport: campaign.extend("/review/report"),
  reviewerSession: campaign.extend("/review/sessions/:agentSessionId"),
}

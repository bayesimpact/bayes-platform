import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/studio")
const organization = home.extend("/o/:organizationId")
const project = organization.extend("/p/:projectId")

// PROJECT-LEVEL
const agent = project.extend("/a/:agentId")
const documents = project.extend("/d")
const webSources = project.extend("/web-sources")
const document = documents.extend("/:documentId")
const projectAnalytics = project.extend("/analytics")
const evaluation = project.extend("/evaluation")
const projectMemberships = project.extend("/members")
const projectMembership = projectMemberships.extend("/:membershipId")
const reviewCampaigns = project.extend("/review-campaigns")
const reviewCampaignReport = reviewCampaigns.extend("/:reviewCampaignId/report")
const projectAdmin = project.extend("/admin")

// AGENT-LEVEL
const agentSession = agent.extend("/as/:agentSessionId")
const agentEdit = agent.extend("/edit")
const feedback = agent.extend("/f")
const agentMemberships = agent.extend("/members")
const agentAnalytics = agent.extend("/analytics")

export const StudioRoutes = {
  agent,
  agentAnalytics,
  agentEdit,
  agentMemberships,
  agentSession,
  document,
  documents,
  evaluation,
  feedback,
  home,
  organization,
  project,
  projectAdmin,
  projectAnalytics,
  projectMembership,
  projectMemberships,
  reviewCampaignReport,
  reviewCampaigns,
  webSources,
}

// FIXME: to be removed (alexis)
export const isStudioInterface = () => window.location.pathname.startsWith(StudioRoutes.home.path)

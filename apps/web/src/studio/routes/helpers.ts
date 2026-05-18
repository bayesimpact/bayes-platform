import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/studio")
const organization = home.extend("/o/:organizationId")
const project = organization.extend("/p/:projectId")

// PROJECT-LEVEL
const agent = project.extend("/a/:agentId")
const documents = project.extend("/d")
const document = documents.extend("/:documentId")
const projectAnalytics = project.extend("/analytics")
const evaluation = project.extend("/eval")
const projectMemberships = project.extend("/members")
const projectMembership = projectMemberships.extend("/:membershipId")
const reviewCampaigns = project.extend("/review-campaigns")
const reviewCampaignReport = reviewCampaigns.extend("/:reviewCampaignId/report")

// AGENT-LEVEL
const agentSession = agent.extend("/as/:agentSessionId")
const feedback = agent.extend("/f")
const agentMemberships = agent.extend("/members")
const agentAnalytics = agent.extend("/analytics")

export const StudioRoutes = {
  agent,
  agentAnalytics,
  agentMemberships,
  agentSession,
  document,
  documents,
  evaluation,
  feedback,
  home,
  organization,
  project,
  projectAnalytics,
  projectMembership,
  projectMemberships,
  reviewCampaignReport,
  reviewCampaigns,
}

export const isStudioInterface = () => window.location.pathname.startsWith(StudioRoutes.home.path)

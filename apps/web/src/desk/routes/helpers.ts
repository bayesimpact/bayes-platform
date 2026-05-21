import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/app")
const organization = home.extend("/o/:organizationId")
const project = organization.extend("/p/:projectId")

// PROJECT-LEVEL
const agent = project.extend("/a/:agentId")

// AGENT-LEVEL
const agentSession = agent.extend("/as/:agentSessionId")

export const DeskRoutes = {
  agent,
  agentSession,
  home,
  organization,
  project,
}

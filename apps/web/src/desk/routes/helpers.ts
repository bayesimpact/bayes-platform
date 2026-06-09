import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/app")
const organization = home.extend("/o/:organizationId")
const project = organization.extend("/p/:projectId")

// PROJECT-LEVEL
const agent = project.extend("/a/:agentId")

// AGENT-LEVEL
const agentSession = agent.extend("/as/:agentSessionId")
const agentExtraction = agent.extend("/extraction")
const agentExtractionCsvRun = agentExtraction.extend("/csv-runs/:csvRunId")

export const DeskRoutes = {
  agent,
  agentExtraction,
  agentExtractionCsvRun,
  agentSession,
  home,
  organization,
  project,
}

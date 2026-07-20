import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/eval")
const organization = home.extend("/o/:organizationId")
const project = organization.extend("/p/:projectId")

// PROJECT-LEVEL
const extraction = project.extend("/extraction")
const conversation = project.extend("/conversation")

// EXTRACTION-LEVEL
const extractionDataset = extraction.extend("/:datasetId")
const evaluationRun = extractionDataset.extend("/runs/:runId")

// CONVERSATION-LEVEL
const conversationDataset = conversation.extend("/:datasetId")
const conversationRun = conversationDataset.extend("/runs/:runId")

export const EvalRoutes = {
  conversation,
  conversationDataset,
  conversationRun,
  evaluationRun,
  extraction,
  extractionDataset,
  home,
  organization,
  project,
}

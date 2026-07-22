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
// Selected run ids are carried in the `?runs=id1,id2` query string.
const conversationDatasetCompare = conversationDataset.extend("/compare")

export const EvalRoutes = {
  conversation,
  conversationDataset,
  conversationDatasetCompare,
  conversationRun,
  evaluationRun,
  extraction,
  extractionDataset,
  home,
  organization,
  project,
}

import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/eval")
const organization = home.extend("/o/:organizationId")
const project = organization.extend("/p/:projectId")

// PROJECT-LEVEL
const extraction = project.extend("/extraction")

// EXTRACTION-LEVEL
const extractionDataset = extraction.extend("/:datasetId")
const evaluationRun = extractionDataset.extend("/runs/:runId")

export const EvalRoutes = {
  evaluationRun,
  extraction,
  extractionDataset,
  home,
  organization,
  project,
}

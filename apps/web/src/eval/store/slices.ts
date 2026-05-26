import { agentsMiddleware } from "@/common/features/agents/agents.middleware"
import { agentsSlice } from "@/common/features/agents/agents.slice"
import { projectsMiddleware } from "@/common/features/projects/projects.middleware"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { createSliceManager } from "@/common/store/dynamic-middleware"
import { evaluationExtractionDatasetsMiddleware } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.middleware"
import { evaluationExtractionDatasetsSlice } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"
import { evaluationExtractionRunsMiddleware } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.middleware"
import { evaluationExtractionRunsSlice } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.slice"
import { currentIdsSlice } from "./currentIds.slice"

const evalMiddlewareList = [
  agentsMiddleware,
  evaluationExtractionDatasetsMiddleware,
  evaluationExtractionRunsMiddleware,
  projectsMiddleware,
]

export const evalSliceList = [
  agentsSlice,
  currentIdsSlice,
  evaluationExtractionDatasetsSlice,
  evaluationExtractionRunsSlice,
  projectsSlice,
]

export const { injectSlices: injectEvalSlices, resetSlices: resetEvalSlices } = createSliceManager({
  middlewares: evalMiddlewareList,
  slices: evalSliceList,
})

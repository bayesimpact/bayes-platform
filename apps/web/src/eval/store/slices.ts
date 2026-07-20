import { agentsMiddleware } from "@/common/features/agents/agents.middleware"
import { agentsSlice } from "@/common/features/agents/agents.slice"
import { projectsSlice } from "@/common/features/projects/projects.slice"
import { createSliceManager } from "@/common/store/dynamic-middleware"
import { evaluationConversationDatasetsMiddleware } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.middleware"
import { evaluationConversationDatasetsSlice } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import { evaluationConversationRunsMiddleware } from "../features/evaluation-conversation-runs/evaluation-conversation-runs.middleware"
import { evaluationConversationRunsSlice } from "../features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { evaluationExtractionDatasetsMiddleware } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.middleware"
import { evaluationExtractionDatasetsSlice } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"
import { evaluationExtractionRunsMiddleware } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.middleware"
import { evaluationExtractionRunsSlice } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.slice"
import { currentIdsSlice } from "./currentIds.slice"

const evalMiddlewareList = [
  agentsMiddleware,
  evaluationConversationDatasetsMiddleware,
  evaluationConversationRunsMiddleware,
  evaluationExtractionDatasetsMiddleware,
  evaluationExtractionRunsMiddleware,
]

export const evalSliceList = [
  agentsSlice,
  currentIdsSlice,
  evaluationConversationDatasetsSlice,
  evaluationConversationRunsSlice,
  evaluationExtractionDatasetsSlice,
  evaluationExtractionRunsSlice,
  projectsSlice,
]

export const { injectSlices: injectEvalSlices, resetSlices: resetEvalSlices } = createSliceManager({
  middlewares: evalMiddlewareList,
  slices: evalSliceList,
})

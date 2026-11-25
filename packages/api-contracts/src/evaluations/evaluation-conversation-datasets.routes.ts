import type { ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type { EvaluationConversationDatasetDto } from "./evaluation-conversation-datasets.dto"

const prefix = "organizations/:organizationId/projects/:projectId/evaluation-conversation-datasets"

/**
 * Evaluation serves its own dataset routes under `eval/`. Only the list is left here: the Studio
 * reads it to save a conversation as a test case.
 */
export const EvaluationConversationDatasetsRoutes = {
  getAll: defineRoute<ResponseData<EvaluationConversationDatasetDto[]>>({
    method: "get",
    path: prefix,
  }),
}

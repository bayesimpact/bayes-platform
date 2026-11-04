import { EvalProjectsRoutes } from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { listEvaluationProjects } from "../evaluation-projects"
import { projectKeys } from "./keys"

/** The projects the person can evaluate (`GET projects/mine`, kept to `evaluation.ui.read`). */
export const evaluationProjectsQueryOptions = () =>
  queryOptions({
    queryKey: projectKeys.evaluation(),
    queryFn: async ({ signal }) =>
      listEvaluationProjects(await apiRequest(EvalProjectsRoutes.getAllMine, { signal })),
  })

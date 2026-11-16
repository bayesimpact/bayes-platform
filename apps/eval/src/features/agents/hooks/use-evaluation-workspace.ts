import { useSuspenseQuery } from "@tanstack/react-query"
import { evaluationWorkspaceQueryOptions } from "../api/queries"
import type { EvaluationWorkspace } from "../evaluation-agents"

/** What the person can evaluate, from the query `loadEvaluationWorkspace` started. */
export function useEvaluationWorkspace(): EvaluationWorkspace {
  return useSuspenseQuery(evaluationWorkspaceQueryOptions()).data
}

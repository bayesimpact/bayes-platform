import type { QueryClient } from "@tanstack/react-query"
import { loaderStaleTime } from "@/lib/start-query"
import { evaluationWorkspaceQueryOptions } from "./api/queries"
import type { EvaluationWorkspace } from "./evaluation-agents"

/** Loads, for a route's `beforeLoad` or loader, what the person can evaluate, which stays cached. */
export function loadEvaluationWorkspace(queryClient: QueryClient): Promise<EvaluationWorkspace> {
  return queryClient.query({ ...evaluationWorkspaceQueryOptions(), staleTime: loaderStaleTime })
}

/** Loads what the person holds again, after they joined a project, an agent or a campaign. */
export function refreshEvaluationWorkspace(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: evaluationWorkspaceQueryOptions().queryKey })
}

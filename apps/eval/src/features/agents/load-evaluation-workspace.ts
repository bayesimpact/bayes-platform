import type { QueryClient } from "@tanstack/react-query"
import { loaderStaleTime } from "@/lib/start-query"
import { evaluationWorkspaceQueryOptions } from "./api/queries"
import type { EvaluationWorkspace } from "./evaluation-agents"

/** Loads, for a route's `beforeLoad` or loader, what the person can evaluate, which stays cached. */
export function loadEvaluationWorkspace(queryClient: QueryClient): Promise<EvaluationWorkspace> {
  return queryClient.query({ ...evaluationWorkspaceQueryOptions(), staleTime: loaderStaleTime })
}

import type { MyProjectOutputDto } from "@caseai-connect/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { loaderStaleTime } from "@/lib/start-query"
import { evaluationProjectsQueryOptions } from "./api/queries"

/** Loads, for a route's loader, the projects the person can evaluate, which stay in the cache. */
export function loadEvaluationProjects(queryClient: QueryClient): Promise<MyProjectOutputDto[]> {
  return queryClient.query({ ...evaluationProjectsQueryOptions(), staleTime: loaderStaleTime })
}

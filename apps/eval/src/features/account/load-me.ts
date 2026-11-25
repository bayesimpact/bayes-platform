import type { MeOutputDto } from "@bayes-platform/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { loaderStaleTime } from "@/lib/start-query"
import { meQueryOptions } from "./api/queries"

/** Loads, for a route's loader, the signed-in person, who stays in the cache. */
export function loadMe(queryClient: QueryClient): Promise<MeOutputDto> {
  return queryClient.query({ ...meQueryOptions(), staleTime: loaderStaleTime })
}

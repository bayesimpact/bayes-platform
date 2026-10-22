import type { QueryClient } from "@tanstack/react-query"
import { deskAgentsQueryOptions } from "./api/queries"
import type { DeskProjectAgents } from "./desk-agents"

/** Loads, for a route's `beforeLoad` or loader, the person's agents, which stay in the cache. */
export function loadDeskAgents(queryClient: QueryClient): Promise<DeskProjectAgents[]> {
  return queryClient.query({ ...deskAgentsQueryOptions(), staleTime: "static" })
}

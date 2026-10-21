import { DeskMemoriesRoutes } from "@caseai-connect/desk-contracts"
import { type QueryClient, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import type { MemoryAgent } from "../memory-agent"
import { memoryKeys } from "./keys"

/** The facts an agent remembers about the signed-in person, saved and proposed. */
export const memoriesQueryOptions = (agent: MemoryAgent) =>
  queryOptions({
    queryKey: memoryKeys.agent(agent.agentId),
    queryFn: ({ signal }) => apiRequest(DeskMemoriesRoutes.getAll, { params: agent, signal }),
  })

/** Marks an agent's memory stale, after a reply saved or forgot facts. */
export function invalidateMemories(queryClient: QueryClient, agentId: string): void {
  void queryClient.invalidateQueries({ queryKey: memoryKeys.agent(agentId) })
}

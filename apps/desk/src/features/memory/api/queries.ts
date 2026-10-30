import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { DeskMemoriesRoutes } from "@caseai-connect/desk-contracts"
import { type QueryClient, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { memoryKeys } from "./keys"

/** The facts an agent remembers about the signed-in person, saved and proposed. */
export const memoriesQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: memoryKeys.agent(agent.agentId),
    queryFn: ({ signal }) => apiRequest(DeskMemoriesRoutes.getAll, { params: agent, signal }),
  })

/** Refreshes an agent's memory, after a reply or the person saved or forgot facts. */
export function invalidateMemories(queryClient: QueryClient, agentId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: memoryKeys.agent(agentId) })
}

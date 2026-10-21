import { DeskAgentSessionsRoutes } from "@caseai-connect/desk-contracts"
import { type QueryClient, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import type { HistoryAgent } from "../history-entries"
import { historyKeys } from "./keys"

const agentParams = (agent: HistoryAgent) => ({
  organizationId: agent.organizationId,
  projectId: agent.projectId,
  agentId: agent.agentId,
})

/** The person's own conversations with a conversation agent, newest first. */
export const conversationsQueryOptions = (agent: HistoryAgent) =>
  queryOptions({
    queryKey: historyKeys.conversations(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getConversations, { params: agentParams(agent), signal }),
  })

/** The person's own extractions of one document by an extraction agent. */
export const extractionRunsQueryOptions = (agent: HistoryAgent) =>
  queryOptions({
    queryKey: historyKeys.extractionRuns(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getExtractionRuns, { params: agentParams(agent), signal }),
  })

/** The person's own extractions of a CSV file by an extraction agent. */
export const csvExtractionRunsQueryOptions = (agent: HistoryAgent) =>
  queryOptions({
    queryKey: historyKeys.csvExtractionRuns(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getCsvExtractionRuns, {
        params: agentParams(agent),
        signal,
      }),
  })

/**
 * Starts, unawaited, the queries of an agent's history, so the sidebar's history loads without
 * blocking the page: one for a conversation agent, two for an extraction agent.
 */
export function prefetchAgentHistory(queryClient: QueryClient, agent: HistoryAgent): void {
  if (agent.type === "conversation") {
    void queryClient.prefetchQuery(conversationsQueryOptions(agent))
    return
  }
  void queryClient.prefetchQuery(extractionRunsQueryOptions(agent))
  void queryClient.prefetchQuery(csvExtractionRunsQueryOptions(agent))
}

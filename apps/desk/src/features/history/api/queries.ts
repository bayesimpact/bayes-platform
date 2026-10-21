import { DeskAgentSessionsRoutes, DeskExtractionsRoutes } from "@caseai-connect/desk-contracts"
import { type QueryClient, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type HistoryAgent, hasPendingRun } from "../history-entries"
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

/** While an extraction of the history goes on, the history asks how it goes this often. */
const PENDING_INTERVAL_IN_MILLISECONDS = 5000

/**
 * The history's interval: every 5 s while one of its extractions goes on, so its mark turns once
 * it ends. The two lists share the answer, read from the cache.
 */
const pendingInterval =
  (queryClient: QueryClient | undefined, agent: HistoryAgent) => (failureCount: number) => {
    if (!queryClient || failureCount >= 3) return false
    const isPending = hasPendingRun(
      queryClient.getQueryData(historyKeys.extractionRuns(agent.agentId)),
      queryClient.getQueryData(historyKeys.csvExtractionRuns(agent.agentId)),
    )
    return isPending ? PENDING_INTERVAL_IN_MILLISECONDS : false
  }

/** The person's own extractions of one document by an extraction agent. */
export const extractionRunsQueryOptions = (agent: HistoryAgent, queryClient?: QueryClient) =>
  queryOptions({
    queryKey: historyKeys.extractionRuns(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getExtractionRuns, { params: agentParams(agent), signal }),
    refetchInterval: (query) => pendingInterval(queryClient, agent)(query.state.fetchFailureCount),
  })

/** The person's own extractions of a CSV file by an extraction agent. */
export const csvExtractionRunsQueryOptions = (agent: HistoryAgent, queryClient?: QueryClient) =>
  queryOptions({
    queryKey: historyKeys.csvExtractionRuns(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getCsvExtractionRuns, {
        params: agentParams(agent),
        signal,
      }),
    refetchInterval: (query) => pendingInterval(queryClient, agent)(query.state.fetchFailureCount),
  })

/**
 * The documents the person uploaded for an extraction agent, newest first: the history names a
 * CSV run by its file, and a new extraction offers them again.
 */
export const extractionDocumentsQueryOptions = (agent: {
  organizationId: string
  projectId: string
  agentId: string
}) =>
  queryOptions({
    queryKey: historyKeys.extractionDocuments(agent.agentId),
    queryFn: async ({ signal }) => {
      const documents = await apiRequest(DeskExtractionsRoutes.getMyDocuments, {
        params: {
          organizationId: agent.organizationId,
          projectId: agent.projectId,
          agentId: agent.agentId,
        },
        signal,
      })
      return [...documents].sort((first, second) => second.createdAt - first.createdAt)
    },
  })

/**
 * Starts, unawaited, the queries of an agent's history, so the sidebar's history loads without
 * blocking the page: one for a conversation agent, three for an extraction agent.
 */
export function prefetchAgentHistory(queryClient: QueryClient, agent: HistoryAgent): void {
  if (agent.type === "conversation") {
    void queryClient.prefetchQuery(conversationsQueryOptions(agent))
    return
  }
  void queryClient.prefetchQuery(extractionRunsQueryOptions(agent))
  void queryClient.prefetchQuery(csvExtractionRunsQueryOptions(agent))
  void queryClient.prefetchQuery(extractionDocumentsQueryOptions(agent))
}

/** Marks an agent's history stale, after a session started, changed or was deleted. */
export function invalidateAgentHistory(queryClient: QueryClient, agentId: string): void {
  void queryClient.invalidateQueries({ queryKey: historyKeys.agent(agentId) })
}

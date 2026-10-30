import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { DeskAgentSessionsRoutes, DeskExtractionsRoutes } from "@caseai-connect/desk-contracts"
import { type QueryClient, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { pollWhile } from "@/lib/polling"
import { startQuery } from "@/lib/start-query"
import { type HistoryAgent, hasPendingCsvRun, hasPendingExtractionRun } from "../history-entries"
import { historyKeys } from "./keys"

/** While an extraction of the history goes on, its list asks how it goes this often. */
const PENDING_INTERVAL_IN_MILLISECONDS = 5000

/** The person's own conversations with a conversation agent, newest first. */
export const conversationsQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: historyKeys.conversations(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getConversations, { params: agent, signal }),
  })

/**
 * The person's own extractions of one document by an extraction agent. While one goes on, the
 * list asks every 5 s how it goes, so its mark turns once it ends.
 */
export const extractionRunsQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: historyKeys.extractionRuns(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getExtractionRuns, { params: agent, signal }),
    refetchInterval: pollWhile(hasPendingExtractionRun, PENDING_INTERVAL_IN_MILLISECONDS),
  })

/** The person's own extractions of a CSV file by an extraction agent, polled as the above. */
export const csvExtractionRunsQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: historyKeys.csvExtractionRuns(agent.agentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskAgentSessionsRoutes.getCsvExtractionRuns, { params: agent, signal }),
    refetchInterval: pollWhile(hasPendingCsvRun, PENDING_INTERVAL_IN_MILLISECONDS),
  })

/**
 * The documents the person uploaded for an extraction agent, newest first: the history names a
 * CSV run by its file, and a new extraction offers them again. It lives here rather than in
 * `features/extraction`, which imports this feature: the history needs it, and the other way
 * round would make the two features import each other.
 */
export const extractionDocumentsQueryOptions = (agent: AgentParamsDto) =>
  queryOptions({
    queryKey: historyKeys.extractionDocuments(agent.agentId),
    queryFn: async ({ signal }) => {
      const documents = await apiRequest(DeskExtractionsRoutes.getMyDocuments, {
        params: agent,
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
    startQuery(queryClient, conversationsQueryOptions(agent))
    return
  }
  startQuery(queryClient, extractionRunsQueryOptions(agent))
  startQuery(queryClient, csvExtractionRunsQueryOptions(agent))
  startQuery(queryClient, extractionDocumentsQueryOptions(agent))
}

/**
 * Refreshes an agent's history, after a session started, changed or was deleted. A mutation
 * returns it from `onSettled`, so its own callbacks, and the page they open, see the new history.
 */
export function invalidateAgentHistory(queryClient: QueryClient, agentId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: historyKeys.agent(agentId) })
}

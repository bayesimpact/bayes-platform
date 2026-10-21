import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query"
import {
  conversationsQueryOptions,
  csvExtractionRunsQueryOptions,
  extractionDocumentsQueryOptions,
  extractionRunsQueryOptions,
} from "../api/queries"
import {
  conversationEntries,
  extractionEntries,
  type HistoryAgent,
  type HistoryEntry,
} from "../history-entries"

/** A conversation agent's history, from the query the agent's route prefetched. */
export function useConversationEntries(agent: HistoryAgent): HistoryEntry[] {
  const { data } = useSuspenseQuery(conversationsQueryOptions(agent))
  return conversationEntries(data)
}

/** An extraction agent's history, documents and CSV files mixed, from the prefetched queries. */
export function useExtractionEntries(agent: HistoryAgent): HistoryEntry[] {
  const queryClient = useQueryClient()
  return useSuspenseQueries({
    queries: [
      extractionRunsQueryOptions(agent, queryClient),
      csvExtractionRunsQueryOptions(agent, queryClient),
      extractionDocumentsQueryOptions(agent),
    ],
    combine: ([extractionRuns, csvExtractionRuns, documents]) =>
      extractionEntries(extractionRuns.data, csvExtractionRuns.data, documents.data),
  })
}

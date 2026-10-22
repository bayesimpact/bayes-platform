import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import {
  DeskConversationsRoutes,
  DeskCsvExtractionsRoutes,
  DeskExtractionsRoutes,
} from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import type { HistoryEntry } from "../history-entries"
import { invalidateAgentHistory } from "./queries"

/** The entry of the history to delete: its kind picks the route. */
export type DeletedEntry = Pick<HistoryEntry, "kind" | "id">

/** Deletes a conversation or an extraction of the person's history, and refreshes the history. */
export function useDeleteHistoryEntry(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: DeletedEntry) => {
      switch (entry.kind) {
        case "conversation":
          return apiRequest(DeskConversationsRoutes.deleteOne, {
            params: { ...agent, agentSessionId: entry.id },
          })
        case "extraction":
          return apiRequest(DeskExtractionsRoutes.deleteOne, {
            params: { ...agent, agentSessionId: entry.id },
          })
        case "csv":
          return apiRequest(DeskCsvExtractionsRoutes.deleteOne, {
            params: { ...agent, agentCsvExtractionRunId: entry.id },
          })
        default:
          return entry.kind satisfies never
      }
    },
    // The entry's own queries go with it, or a step back in the browser would show it again: its
    // id, a UUID, is in each of their keys, whichever feature owns them.
    onSuccess: (_, entry) => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey.includes(entry.id) })
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

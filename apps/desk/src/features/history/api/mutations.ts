import {
  DeskConversationsRoutes,
  DeskCsvExtractionsRoutes,
  DeskExtractionsRoutes,
} from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import type { HistoryAgent, HistoryEntry } from "../history-entries"
import { invalidateAgentHistory } from "./queries"

/** The entry of the history to delete: its kind picks the route. */
export type DeletedEntry = Pick<HistoryEntry, "kind" | "id">

/** Deletes a conversation or an extraction of the person's history, and refreshes the history. */
export function useDeleteHistoryEntry(agent: Omit<HistoryAgent, "type">) {
  const queryClient = useQueryClient()
  const params = {
    organizationId: agent.organizationId,
    projectId: agent.projectId,
    agentId: agent.agentId,
  }
  return useMutation({
    mutationFn: (entry: DeletedEntry) => {
      switch (entry.kind) {
        case "conversation":
          return apiRequest(DeskConversationsRoutes.deleteOne, {
            params: { ...params, agentSessionId: entry.id },
          })
        case "extraction":
          return apiRequest(DeskExtractionsRoutes.deleteOne, {
            params: { ...params, agentSessionId: entry.id },
          })
        case "csv":
          return apiRequest(DeskCsvExtractionsRoutes.deleteOne, {
            params: { ...params, agentCsvExtractionRunId: entry.id },
          })
      }
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

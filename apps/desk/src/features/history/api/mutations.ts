import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import type { HistoryAgent } from "../history-entries"
import { invalidateAgentHistory } from "./queries"

/** Deletes one of the person's conversations, and refreshes the history. */
export function useDeleteConversation(agent: HistoryAgent) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (agentSessionId: string) =>
      apiRequest(DeskConversationsRoutes.deleteOne, {
        params: {
          organizationId: agent.organizationId,
          projectId: agent.projectId,
          agentId: agent.agentId,
          agentSessionId,
        },
      }),
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

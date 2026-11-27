import { type OutgoingMessage, useChat } from "@caseai-connect/chat"
import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { invalidateAgentHistory } from "@/features/history"
import { apiRequest } from "@/lib/api-client"

/**
 * Starts a conversation with its first message, as in the Claude app: creates it, opens it, then
 * streams the replies there.
 */
export function useStartConversation(agent: AgentParamsDto) {
  const chat = useChat()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (outgoing: OutgoingMessage) => {
      const created = await apiRequest(DeskConversationsRoutes.createOne, {
        params: agent,
        body: {},
      })
      invalidateAgentHistory(queryClient, agent.agentId)
      const conversation = { ...agent, agentSessionId: created.id }
      // The conversation's loader reads its messages, the agent's greeting among them, first.
      await navigate({
        to: "/o/$organizationId/p/$projectId/a/$agentId/as/$agentSessionId",
        params: conversation,
      })
      await chat.streamReply(queryClient, conversation, outgoing)
    },
  })
}

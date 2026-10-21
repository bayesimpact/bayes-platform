import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { invalidateAgentHistory } from "@/features/history"
import { apiRequest } from "@/lib/api-client"
import type { ConversationAgentRef, ConversationRef } from "../conversation-ref"
import { streamReply } from "./stream-reply"

/** Sends a message in a conversation and streams the replies into its messages. */
export function useSendMessage(conversation: ConversationRef) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => streamReply(queryClient, conversation, content),
  })
}

/**
 * Starts a conversation with its first message, as in the Claude app: creates it, opens it, then
 * streams the replies there.
 */
export function useStartConversation(agent: ConversationAgentRef) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (content: string) => {
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
      await streamReply(queryClient, conversation, content)
    },
  })
}

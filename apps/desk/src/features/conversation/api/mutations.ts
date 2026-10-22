import type { AgentParamsDto, ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { DeskConversationsRoutes, DeskDocumentsRoutes } from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { invalidateAgentHistory } from "@/features/history"
import { apiRequest } from "@/lib/api-client"
import { openInTab } from "@/lib/safe-url"
import type { OutgoingMessage } from "../chat-messages"
import { streamReply } from "./stream-reply"

/** Sends a message in a conversation and streams the replies into its messages. */
export function useSendMessage(conversation: ConversationParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outgoing: OutgoingMessage) => streamReply(queryClient, conversation, outgoing),
  })
}

/** Reports a problem with one of the agent's replies. */
export function useSendFeedback(conversation: ConversationParamsDto) {
  return useMutation({
    mutationFn: ({ agentMessageId, content }: { agentMessageId: string; content: string }) =>
      apiRequest(DeskConversationsRoutes.createMessageFeedback, {
        params: { ...conversation, agentMessageId },
        body: { content },
      }),
  })
}

/**
 * Starts a conversation with its first message, as in the Claude app: creates it, opens it, then
 * streams the replies there.
 */
export function useStartConversation(agent: AgentParamsDto) {
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
      await streamReply(queryClient, conversation, outgoing)
    },
  })
}

/**
 * Opens a document a reply cites, in a new tab. The tab opens at once, while the click still
 * counts as the person's, and goes to the file once its short-lived URL arrives.
 */
export function useOpenDocument(conversation: ConversationParamsDto) {
  return useMutation({
    mutationFn: ({ documentId, tab }: { documentId: string; tab: Window | null }) =>
      openInTab(tab, async () => {
        const { url } = await apiRequest(DeskDocumentsRoutes.getTemporaryUrl, {
          params: { ...conversation, documentId },
        })
        return url
      }),
  })
}

/** Opens the file a person attached to a message, in a new tab, as `useOpenDocument` does. */
export function useOpenAttachment(conversation: ConversationParamsDto) {
  return useMutation({
    mutationFn: async ({
      attachmentDocumentId,
      tab,
    }: {
      attachmentDocumentId: string
      tab: Window | null
    }) =>
      openInTab(tab, async () => {
        const { url } = await apiRequest(DeskConversationsRoutes.getAttachmentUrl, {
          params: { ...conversation, attachmentDocumentId },
        })
        return url
      }),
  })
}

import type { OutgoingMessage } from "@caseai-connect/chat"
import {
  type ConversationParamsDto,
  EvalConversationsRoutes,
  EvalDocumentsRoutes,
  type MessageFeedbackInputDto,
  type MessageParamsDto,
} from "@caseai-connect/eval-contracts"
import { openInTab } from "@caseai-connect/frontend-lib"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { streamReply } from "./stream-reply"

/**
 * Sends a message in a conversation and streams the replies into its messages. `onFormsChange`
 * is called each time the agent fills in a form, which the conversation's owner then loads again.
 */
export function useSendMessage(conversation: ConversationParamsDto, onFormsChange: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outgoing: OutgoingMessage) =>
      streamReply(queryClient, conversation, outgoing, onFormsChange),
  })
}

/** Gives a thumbs-up to one of the agent's replies, or reports a problem with it. */
export function useSendFeedback(conversation: ConversationParamsDto) {
  return useMutation({
    mutationFn: ({
      agentMessageId,
      feedback,
    }: Pick<MessageParamsDto, "agentMessageId"> & { feedback: MessageFeedbackInputDto }) =>
      apiRequest(EvalConversationsRoutes.createMessageFeedback, {
        params: { ...conversation, agentMessageId },
        body: feedback,
      }),
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
        const { url } = await apiRequest(EvalDocumentsRoutes.getTemporaryUrl, {
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
        const { url } = await apiRequest(EvalConversationsRoutes.getAttachmentUrl, {
          params: { ...conversation, attachmentDocumentId },
        })
        return url
      }),
  })
}

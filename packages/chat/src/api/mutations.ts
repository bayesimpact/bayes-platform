import type {
  ConversationParamsDto,
  MessageFeedbackInputDto,
  MessageParamsDto,
} from "@caseai-connect/chat-contracts"
import { openInTab } from "@caseai-connect/frontend-lib"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useChat } from "../chat-context"
import type { OutgoingMessage } from "../chat-messages"

/** Sends a message in a conversation and streams the replies into its messages. */
export function useSendMessage(conversation: ConversationParamsDto) {
  const chat = useChat()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outgoing: OutgoingMessage) =>
      chat.streamReply(queryClient, conversation, outgoing),
  })
}

/** Gives a thumbs-up to one of the agent's replies, or reports a problem with it. */
export function useSendFeedback(conversation: ConversationParamsDto) {
  const chat = useChat()
  return useMutation({
    mutationFn: (
      input: Pick<MessageParamsDto, "agentMessageId"> & { feedback: MessageFeedbackInputDto },
    ) => chat.sendFeedback(conversation, input),
  })
}

/**
 * Opens a document a reply cites, in a new tab. The tab opens at once, while the click still
 * counts as the person's, and goes to the file once its short-lived URL arrives.
 */
export function useOpenDocument(conversation: ConversationParamsDto) {
  const chat = useChat()
  return useMutation({
    mutationFn: ({ documentId, tab }: { documentId: string; tab: Window | null }) =>
      openInTab(tab, () => chat.getDocumentUrl(conversation, documentId)),
  })
}

/** Opens the file a person attached to a message, in a new tab, as `useOpenDocument` does. */
export function useOpenAttachment(conversation: ConversationParamsDto) {
  const chat = useChat()
  return useMutation({
    mutationFn: ({
      attachmentDocumentId,
      tab,
    }: {
      attachmentDocumentId: string
      tab: Window | null
    }) => openInTab(tab, () => chat.getAttachmentUrl(conversation, attachmentDocumentId)),
  })
}

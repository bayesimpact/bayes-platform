import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { composeMessage } from "../annotation"
import { useSendMessage } from "../api/mutations"
import type { OutgoingMessage } from "../chat-messages"
import { useAnnotations } from "./use-annotations"

/**
 * What the person sends in a conversation: their message with the annotations they wrote on the
 * replies, which leave with it, each on a line of its own.
 */
export function useConversationSend(conversation: ConversationParamsDto) {
  const sendMessage = useSendMessage(conversation)
  const annotations = useAnnotations()
  return {
    /** The annotations waiting for the next message, in their order. */
    annotations: annotations.annotations,
    saveAnnotation: annotations.save,
    isSending: sendMessage.isPending,
    send: (outgoing: OutgoingMessage) => {
      const content = composeMessage(outgoing.content, annotations.annotations)
      sendMessage.mutate({ ...outgoing, content })
      annotations.clear()
    },
    /** Sends again a message whose reply failed, as it left the first time. */
    retry: (outgoing: OutgoingMessage) => sendMessage.mutate(outgoing),
  }
}

import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { composeMessage, quoteSourceOf } from "../annotation"
import { useSendMessage } from "../api/mutations"
import type { ChatMessage, OutgoingMessage } from "../chat-messages"
import { taskCheckLine } from "../task-checks"
import { useAnnotations } from "./use-annotations"
import { useTaskChecks } from "./use-task-checks"

/**
 * What the person sends in a conversation: their message with the annotations they wrote on the
 * replies and the tasks they ticked there, which leave with it, each on a line of its own.
 */
export function useConversationSend(conversation: ConversationParamsDto, messages: ChatMessage[]) {
  const sendMessage = useSendMessage(conversation)
  const annotations = useAnnotations()
  const taskChecks = useTaskChecks(messages)
  return {
    /** The tasks of the replies, as the person left them, and their ticks. */
    taskChecks,
    /** The annotations waiting for the next message, in their order. */
    annotations: annotations.annotations,
    saveAnnotation: annotations.save,
    isSending: sendMessage.isPending,
    send: (outgoing: OutgoingMessage) => {
      const content = composeMessage(
        outgoing.content,
        annotations.annotations.map((annotation) => ({
          ...annotation,
          source: quoteSourceOf(annotation),
        })),
        taskChecks.pending.map(taskCheckLine),
      )
      sendMessage.mutate({ ...outgoing, content })
      annotations.clear()
      taskChecks.clear()
    },
    /** Sends again a message whose reply failed, as it left the first time. */
    retry: (outgoing: OutgoingMessage) => sendMessage.mutate(outgoing),
  }
}

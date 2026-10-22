import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import {
  DeskConversationsRoutes,
  type ReplyStreamEventDto,
  replyStreamEventSchema,
} from "@caseai-connect/desk-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { invalidateAgentHistory } from "@/features/history"
import { invalidateMemories } from "@/features/memory"
import { apiStreamResponse } from "@/lib/api-client"
import { readServerSentEvents, type ServerSentEvent } from "@/lib/stream"
import {
  applyReplyEvent,
  type ChatMessage,
  failStreamingReplies,
  newLocalMessageId,
  type OutgoingMessage,
  type ReplyCursor,
  type ReplyFailure,
  setAttachmentDocument,
  startTurn,
} from "../chat-messages"
import { conversationKeys } from "./keys"
import { messagesQueryOptions } from "./queries"
import { registerReplyStream, unregisterReplyStream } from "./reply-streams"
import { uploadAttachment } from "./upload-attachment"

/** The tools that change a form of the conversation, which comes with the agent's history. */
const FORM_TOOLS = new Set(["fillForm", "consolidateForm"])

/** The tools that change what the agent remembers about the person. */
const MEMORY_TOOLS = new Set(["saveMemory", "forgetMemory"])

/** An event of the stream, or the failure to read one. */
type ReadEvent = { event: ReplyStreamEventDto } | { failure: ReplyFailure }

/**
 * The event of one frame. Nest writes what the handler throws as an `error` frame whose data is
 * the bare message, not JSON. A frame the event schema rejects fails the reply.
 */
function readEvent(frame: ServerSentEvent): ReadEvent {
  if (frame.event === "error") {
    return frame.data ? { event: { type: "error", error: frame.data } } : { failure: "ended" }
  }
  let data: unknown
  try {
    data = JSON.parse(frame.data)
  } catch {
    console.error("The reply stream sent a frame that is not JSON:", frame.data)
    return { failure: "contract" }
  }
  const result = replyStreamEventSchema.safeParse(data)
  if (!result.success) {
    console.error("The reply stream broke its contract:", z.prettifyError(result.error))
    return { failure: "contract" }
  }
  return { event: result.data }
}

/**
 * Sends a message and streams the replies into the conversation's messages: the person's message
 * and an empty reply first, then the text as it comes. Each agent that speaks sends a `start` and
 * an `end`. A stream that closes before every reply ended fails them. Leaving the conversation
 * stops reading; the server keeps writing, and the messages refetch once the stream is over.
 */
export async function streamReply(
  queryClient: QueryClient,
  conversation: ConversationParamsDto,
  outgoing: OutgoingMessage,
): Promise<void> {
  // The key of the messages' query carries their type: the cache's reads and writes are checked.
  const { queryKey } = messagesQueryOptions(conversation)
  await queryClient.cancelQueries({ queryKey })
  const controller = registerReplyStream(conversation.agentSessionId)
  const replyId = newLocalMessageId()
  const update = (change: (messages: ChatMessage[]) => ChatMessage[]) =>
    queryClient.setQueryData(queryKey, (messages = []) => change(messages))

  const userMessageId = newLocalMessageId()
  update((messages) => startTurn(messages, outgoing, { userMessageId, replyId }, Date.now()))
  let cursor: ReplyCursor = { messageId: replyId, hasStarted: false }
  let hasFailed = true
  try {
    let attachmentDocumentId: string | undefined
    if (outgoing.attachment && "file" in outgoing.attachment) {
      try {
        attachmentDocumentId = await uploadAttachment(
          conversation,
          outgoing.attachment.file,
          controller.signal,
        )
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("The attachment could not be uploaded:", error)
        update((messages) => failStreamingReplies(messages, "upload"))
        return
      }
      const documentId = attachmentDocumentId
      update((messages) => setAttachmentDocument(messages, userMessageId, documentId))
    } else if (outgoing.attachment) {
      attachmentDocumentId = outgoing.attachment.documentId
    }
    const response = await apiStreamResponse(DeskConversationsRoutes.streamReply, {
      params: conversation,
      query: { q: { payload: { content: outgoing.content, attachmentDocumentId } } },
      signal: controller.signal,
    })
    if (!response.body) throw new Error("The reply stream has no body")
    for await (const frame of readServerSentEvents(response.body)) {
      const read = readEvent(frame)
      if ("failure" in read) {
        update((messages) => failStreamingReplies(messages, read.failure))
        return
      }
      update((messages) => {
        const next = applyReplyEvent(messages, read.event, cursor, Date.now())
        cursor = next.cursor
        return next.messages
      })
      // A form the agent fills in shows its new answers while the reply goes on.
      if (read.event.type === "notify_client" && FORM_TOOLS.has(read.event.toolName)) {
        void invalidateAgentHistory(queryClient, conversation.agentId)
      }
      // A fact the agent saves or forgets shows in its memory at once.
      if (read.event.type === "notify_client" && MEMORY_TOOLS.has(read.event.toolName)) {
        void invalidateMemories(queryClient, conversation.agentId)
      }
      if (read.event.type === "error") return
    }
    // The body closed: every reply should have ended by now.
    const isUnfinished = (queryClient.getQueryData(queryKey) ?? []).some(
      (message) => message.status === "streaming",
    )
    if (isUnfinished) update((messages) => failStreamingReplies(messages, "ended"))
    hasFailed = isUnfinished
  } catch (error) {
    if (controller.signal.aborted) return
    console.error("The reply could not be streamed:", error)
    update((messages) => failStreamingReplies(messages, "unreachable"))
  } finally {
    unregisterReplyStream(conversation.agentSessionId, controller)
    // The persisted messages replace the local ones. A failed reply stays as it is, with its
    // reason and the retry, until the person sends again or comes back.
    if (!hasFailed || controller.signal.aborted) void queryClient.invalidateQueries({ queryKey })
    // A reply may show an MCP App the conversation did not show yet: its HTML loads again.
    if (!hasFailed) {
      void queryClient.invalidateQueries({
        queryKey: conversationKeys.mcpApps(conversation.agentSessionId),
      })
    }
    // The history gets the conversation's new title.
    void invalidateAgentHistory(queryClient, conversation.agentId)
  }
}

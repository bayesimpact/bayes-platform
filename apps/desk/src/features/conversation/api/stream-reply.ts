import {
  DeskConversationsRoutes,
  type ReplyStreamEventDto,
  replyStreamEventSchema,
} from "@caseai-connect/desk-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { invalidateAgentHistory } from "@/features/history"
import { apiStreamResponse } from "@/lib/api-client"
import { readServerSentEvents, type ServerSentEvent } from "@/lib/stream"
import {
  applyReplyEvent,
  type ChatMessage,
  failStreamingReplies,
  type ReplyCursor,
  type ReplyFailure,
  startTurn,
} from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { conversationKeys } from "./keys"
import { registerReplyStream, unregisterReplyStream } from "./reply-streams"

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
  conversation: ConversationRef,
  content: string,
): Promise<void> {
  const queryKey = conversationKeys.messages(conversation.agentSessionId)
  await queryClient.cancelQueries({ queryKey })
  const controller = registerReplyStream(conversation.agentSessionId)
  const replyId = `local-${crypto.randomUUID()}`
  const update = (change: (messages: ChatMessage[]) => ChatMessage[]) =>
    queryClient.setQueryData<ChatMessage[]>(queryKey, (messages = []) => change(messages))

  update((messages) =>
    startTurn(
      messages,
      content,
      { userMessageId: `local-${crypto.randomUUID()}`, replyId },
      Date.now(),
    ),
  )
  let cursor: ReplyCursor = { messageId: replyId, hasStarted: false }
  let hasFailed = true
  try {
    const response = await apiStreamResponse(DeskConversationsRoutes.streamReply, {
      params: conversation,
      query: { q: { payload: { content } } },
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
      if (read.event.type === "error") return
    }
    // The body closed: every reply should have ended by now.
    const isUnfinished = (queryClient.getQueryData<ChatMessage[]>(queryKey) ?? []).some(
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
    // The history gets the conversation's new title.
    invalidateAgentHistory(queryClient, conversation.agentId)
  }
}

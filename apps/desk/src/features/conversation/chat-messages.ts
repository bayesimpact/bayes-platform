import {
  type ConversationMessageOutputDto,
  type ReplyStreamEventDto,
  type SourcesArgumentsDto,
  type SurfaceResourcesArgumentsDto,
  sourcesArgumentsSchema,
  surfaceResourcesArgumentsSchema,
} from "@caseai-connect/desk-contracts"
import type { z } from "zod"

/** A document a reply relied on, with the passages it cited. */
export type ChatSource = SourcesArgumentsDto["sources"][number]

/** A resource of the agent's libraries a reply points to. */
export type ChatResource = SurfaceResourcesArgumentsDto["resources"][number]

/** Why the Desk itself failed a reply, when the server said nothing. */
export type ReplyFailure = "ended" | "unreachable" | "contract"

/** A message as the conversation shows it. `tool` messages hold tool results and are not shown. */
export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status: "streaming" | "completed" | "aborted" | "error"
  /** The tools the agent called, in order, from the persisted message or the stream. */
  toolNames: string[]
  createdAt: number | null
  /** Set when the Desk failed the reply; the content then holds nothing to show. */
  failure: ReplyFailure | null
  /** The documents the reply relied on, known once the reply is persisted. */
  sources: ChatSource[]
  /** The resources the reply points to, known once the reply is persisted. */
  resources: ChatResource[]
}

type ToolCall = NonNullable<ConversationMessageOutputDto["toolCalls"]>[number]

/**
 * The arguments of the calls of one tool, read with their schema. A call the schema rejects is
 * left out and logged: the rest of the reply still shows.
 */
function readToolArguments<TSchema extends z.ZodType>(
  toolCalls: ToolCall[],
  toolName: string,
  schema: TSchema,
): z.output<TSchema>[] {
  return toolCalls.flatMap((toolCall) => {
    if (toolCall.name !== toolName) return []
    const result = schema.safeParse(toolCall.arguments)
    if (!result.success) {
      console.error(`The arguments of the ${toolName} tool broke their contract:`, result.error)
      return []
    }
    return [result.data]
  })
}

/** The persisted messages as the conversation shows them. */
export function toChatMessages(messages: ConversationMessageOutputDto[]): ChatMessage[] {
  return messages.flatMap((message): ChatMessage[] => {
    if (message.role === "tool") return []
    const toolCalls = message.toolCalls ?? []
    return [
      {
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status ?? "completed",
        toolNames: toolCalls.map((toolCall) => toolCall.name),
        createdAt: message.createdAt ?? null,
        failure: null,
        sources: readToolArguments(toolCalls, "sources", sourcesArgumentsSchema).flatMap(
          (toolArguments) => toolArguments.sources,
        ),
        resources: readToolArguments(
          toolCalls,
          "surfaceResources",
          surfaceResourcesArgumentsSchema,
        ).flatMap((toolArguments) => toolArguments.resources),
      },
    ]
  })
}

/** Where a reply stands while it streams: the message the next events belong to. */
export type ReplyCursor = {
  messageId: string
  /** Whether the server named the first reply yet: its `start` renames the local placeholder. */
  hasStarted: boolean
}

/** The user's message and an empty reply, shown before the server answers. */
export function startTurn(
  messages: ChatMessage[],
  content: string,
  ids: { userMessageId: string; replyId: string },
  now: number,
): ChatMessage[] {
  return [
    ...messages,
    {
      id: ids.userMessageId,
      role: "user",
      content,
      status: "completed",
      toolNames: [],
      createdAt: now,
      failure: null,
      sources: [],
      resources: [],
    },
    {
      id: ids.replyId,
      role: "assistant",
      content: "",
      status: "streaming",
      toolNames: [],
      createdAt: now,
      failure: null,
      sources: [],
      resources: [],
    },
  ]
}

function updateMessage(
  messages: ChatMessage[],
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) => (message.id === messageId ? update(message) : message))
}

/** Applies one event of the reply stream to the messages, and moves the cursor. */
export function applyReplyEvent(
  messages: ChatMessage[],
  event: ReplyStreamEventDto,
  cursor: ReplyCursor,
  now: number,
): { messages: ChatMessage[]; cursor: ReplyCursor } {
  switch (event.type) {
    case "start": {
      if (!cursor.hasStarted) {
        return {
          messages: updateMessage(messages, cursor.messageId, (message) => ({
            ...message,
            id: event.messageId,
          })),
          cursor: { messageId: event.messageId, hasStarted: true },
        }
      }
      // A sub-agent takes over: its reply follows in a message of its own.
      const reply: ChatMessage = {
        id: event.messageId,
        role: "assistant",
        content: "",
        status: "streaming",
        toolNames: [],
        createdAt: now,
        failure: null,
        sources: [],
        resources: [],
      }
      return {
        messages: [...messages, reply],
        cursor: { messageId: event.messageId, hasStarted: true },
      }
    }
    case "chunk":
      return {
        messages: updateMessage(messages, event.messageId, (message) => ({
          ...message,
          content: message.content + event.content,
        })),
        cursor,
      }
    case "notify_client":
      return {
        messages: updateMessage(messages, cursor.messageId, (message) => ({
          ...message,
          toolNames: [...message.toolNames, event.toolName],
        })),
        cursor,
      }
    case "end":
      return {
        messages: updateMessage(messages, event.messageId, (message) => ({
          ...message,
          content: event.fullContent,
          status: "completed",
        })),
        cursor,
      }
    case "error":
      return {
        messages: updateMessage(messages, event.messageId ?? cursor.messageId, (message) => ({
          ...message,
          content: event.error,
          status: "error",
        })),
        cursor,
      }
  }
}

/** Fails the replies still streaming, when the stream broke off or never opened. */
export function failStreamingReplies(
  messages: ChatMessage[],
  failure: ReplyFailure,
): ChatMessage[] {
  return messages.map((message) =>
    message.status === "streaming" ? { ...message, status: "error", failure } : message,
  )
}

/** After this long, a reply the server still marks as streaming shows as interrupted. */
const STREAMING_TIMEOUT_IN_MILLISECONDS = 30 * 60 * 1000

/** Whether a reply is still being written, as far as the Desk can tell. */
export function isWriting(message: ChatMessage, now: number): boolean {
  if (message.status !== "streaming") return false
  return message.createdAt === null || now - message.createdAt < STREAMING_TIMEOUT_IN_MILLISECONDS
}

/** The user message a failed last reply answered, to send again; `null` when there is none. */
export function findRetryableContent(messages: ChatMessage[], now: number): string | null {
  const lastMessage = messages.at(-1)
  const isFailed =
    lastMessage?.role === "assistant" &&
    (lastMessage.status === "error" ||
      lastMessage.status === "aborted" ||
      (lastMessage.status === "streaming" && !isWriting(lastMessage, now)))
  if (!isFailed) return null
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? null
}

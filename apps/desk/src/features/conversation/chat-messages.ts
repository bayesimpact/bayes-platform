import {
  type ConversationMessageOutputDto,
  type ReplyStreamEventDto,
  type SourcesArgumentsDto,
  type SurfaceResourcesArgumentsDto,
  saveMemoryResultSchema,
  sourcesArgumentsSchema,
  surfaceResourcesArgumentsSchema,
} from "@caseai-connect/desk-contracts"
import type { z } from "zod"

/** A document a reply relied on, with the passages it cited. */
export type ChatSource = SourcesArgumentsDto["sources"][number]

/** A resource of the agent's libraries a reply points to. */
export type ChatResource = SurfaceResourcesArgumentsDto["resources"][number]

/** Why the Desk itself failed a reply, when the server said nothing. */
export type ReplyFailure = "ended" | "unreachable" | "contract" | "upload"

/**
 * The file attached to a person's message: its uploaded document once known, and its name while
 * the message is local (the API does not send it back).
 */
export type ChatAttachment = {
  documentId: string | null
  fileName: string | null
}

/** What a person sends: their text, and a file to attach, picked or already uploaded. */
export type OutgoingMessage = {
  content: string
  attachment: { file: File } | { documentId: string } | null
}

/** A message as the conversation shows it. `tool` messages hold tool results and are not shown. */
export type ChatMessage = {
  id: string
  role: Exclude<ConversationMessageOutputDto["role"], "tool">
  content: string
  status: NonNullable<ConversationMessageOutputDto["status"]>
  /** The tools the agent called, in order, from the persisted message or the stream. */
  toolNames: string[]
  createdAt: number | null
  /** Set when the Desk failed the reply; the content then holds nothing to show. */
  failure: ReplyFailure | null
  /** The documents the reply relied on, known once the reply is persisted. */
  sources: ChatSource[]
  /** The resources the reply points to, known once the reply is persisted. */
  resources: ChatResource[]
  /** The file the person attached to their message. */
  attachment: ChatAttachment | null
  /** The facts the reply saved or proposed to remember about the person. */
  memoryIds: string[]
  /** The interactive cards of MCP Apps the reply shows, in the order of its tool calls. */
  mcpApps: ChatMcpApp[]
}

/** An MCP App a tool of the reply shows: where its HTML comes from, and the data it renders. */
export type ChatMcpApp = {
  toolCallId: string
  mcpServerId: string | null
  resourceUri: string
  toolInput: Record<string, unknown>
  toolResult: unknown
}

/** The MCP Apps of a reply: a tool with an app pointer and a kept result. */
function readMcpApps(toolCalls: ToolCall[]): ChatMcpApp[] {
  return toolCalls.flatMap((toolCall) =>
    toolCall.mcpApp && toolCall.result !== undefined
      ? [
          {
            toolCallId: toolCall.id,
            mcpServerId: toolCall.mcpApp.mcpServerId ?? null,
            resourceUri: toolCall.mcpApp.resourceUri,
            toolInput: toolCall.arguments ?? {},
            toolResult: toolCall.result,
          },
        ]
      : [],
  )
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

/** The facts the `saveMemory` calls of a reply saved or proposed, from their results. */
function readSavedMemoryIds(toolCalls: ToolCall[]): string[] {
  return toolCalls.flatMap((toolCall) => {
    if (toolCall.name !== "saveMemory") return []
    const result = saveMemoryResultSchema.safeParse(toolCall.result)
    return result.success ? result.data.memories.map((memory) => memory.id) : []
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
        attachment: message.attachmentDocumentId
          ? { documentId: message.attachmentDocumentId, fileName: null }
          : null,
        memoryIds: readSavedMemoryIds(toolCalls),
        mcpApps: readMcpApps(toolCalls),
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

/** The prefix of the ids this tab gives its messages until the server names them. */
const LOCAL_ID_PREFIX = "local-"

/** An id for a message the server has not named yet. */
export const newLocalMessageId = () => `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`

/** Whether a message is still this tab's own, before the server named it. */
export const isLocalMessageId = (messageId: string) => messageId.startsWith(LOCAL_ID_PREFIX)

/** A message that is still being written, with nothing in it yet. */
function newMessage(id: string, role: ChatMessage["role"], now: number): ChatMessage {
  return {
    id,
    role,
    content: "",
    status: "streaming",
    toolNames: [],
    createdAt: now,
    failure: null,
    sources: [],
    resources: [],
    attachment: null,
    memoryIds: [],
    mcpApps: [],
  }
}

/** The user's message and an empty reply, shown before the server answers. */
export function startTurn(
  messages: ChatMessage[],
  outgoing: OutgoingMessage,
  ids: { userMessageId: string; replyId: string },
  now: number,
): ChatMessage[] {
  const attachment = outgoing.attachment
  const userAttachment: ChatAttachment | null =
    attachment === null
      ? null
      : "file" in attachment
        ? { documentId: null, fileName: attachment.file.name }
        : { documentId: attachment.documentId, fileName: null }
  return [
    ...messages,
    {
      ...newMessage(ids.userMessageId, "user", now),
      content: outgoing.content,
      status: "completed",
      attachment: userAttachment,
    },
    newMessage(ids.replyId, "assistant", now),
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
      return {
        messages: [...messages, newMessage(event.messageId, "assistant", now)],
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

/**
 * The message a failed last reply answered, to send again with its uploaded file; `null` when
 * there is none.
 */
export function findRetryableMessage(messages: ChatMessage[], now: number): OutgoingMessage | null {
  const lastMessage = messages.at(-1)
  const isFailed =
    lastMessage?.role === "assistant" &&
    (lastMessage.status === "error" ||
      lastMessage.status === "aborted" ||
      (lastMessage.status === "streaming" && !isWriting(lastMessage, now)))
  if (!isFailed) return null
  const userMessage = [...messages].reverse().find((message) => message.role === "user")
  if (!userMessage) return null
  const documentId = userMessage.attachment?.documentId
  return { content: userMessage.content, attachment: documentId ? { documentId } : null }
}

/** Notes the uploaded document of the local message of a file, so a retry can send it again. */
export function setAttachmentDocument(
  messages: ChatMessage[],
  userMessageId: string,
  documentId: string,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === userMessageId && message.attachment
      ? { ...message, attachment: { ...message.attachment, documentId } }
      : message,
  )
}

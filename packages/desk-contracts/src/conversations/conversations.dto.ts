import { z } from "zod"
import { agentParamsSchema, projectParamsSchema } from "../common/params.dto"

/** The params of the routes under one conversation. */
export const conversationParamsSchema = agentParamsSchema.extend({ agentSessionId: z.uuid() })

export type ConversationParamsDto = z.output<typeof conversationParamsSchema>

/** A conversation the signed-in person just started, as `.../create` returns it. */
export const createdConversationOutputSchema = z.object({
  id: z.uuid(),
})

export type CreatedConversationOutputDto = z.output<typeof createdConversationOutputSchema>

/**
 * A tool an agent called while it answered. Its arguments and result depend on the tool: the
 * Desk reads those of a few tools with the schemas below, and ignores the others.
 */
export const toolCallOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  /** The raw MCP result of a tool that shows an MCP App, kept only for those tools. */
  result: z.unknown().optional(),
  /** The `ui://` resource of an MCP App the tool shows, as an interactive card. */
  mcpApp: z
    .object({
      /** Left out on the pointers saved before servers were named. */
      mcpServerId: z.string().optional(),
      resourceUri: z.string(),
    })
    .optional(),
})

/** The passages of the knowledge base a reply relied on, by document (the `sources` tool). */
export const sourcesArgumentsSchema = z.object({
  sources: z.array(
    z.object({
      documentId: z.uuid(),
      documentTitle: z.string().optional(),
      /** `webCrawl` for a page of a crawled website, which has no file to download. */
      documentSourceType: z.string().optional(),
      chunks: z.array(z.object({ chunkId: z.string(), partialContent: z.string() })),
    }),
  ),
})

export type SourcesArgumentsDto = z.output<typeof sourcesArgumentsSchema>

/** The resources of the agent's libraries a reply points to (the `surfaceResources` tool). */
export const surfaceResourcesArgumentsSchema = z.object({
  resources: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      /** A URL, or the API path of a file, which redirects to the file. */
      link: z.string(),
    }),
  ),
})

export type SurfaceResourcesArgumentsDto = z.output<typeof surfaceResourcesArgumentsSchema>

/** One message of a conversation, oldest first. `tool` messages hold tool results. */
export const conversationMessageOutputSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  /** Left out on the messages written before statuses existed, which are complete. */
  status: z.enum(["streaming", "completed", "aborted", "error"]).optional(),
  createdAt: z.number().optional(),
  toolCalls: z.array(toolCallOutputSchema).optional(),
  /** The file the person attached to their message. */
  attachmentDocumentId: z.uuid().optional(),
})

export type ConversationMessageOutputDto = z.output<typeof conversationMessageOutputSchema>

/** What the reply stream reads from its `q` parameter: the message, as JSON. */
export const replyInputSchema = z.strictObject({
  payload: z.strictObject({
    content: z.string().trim().min(1),
    /** A file uploaded through the presign route of the conversation. */
    attachmentDocumentId: z.uuid().optional(),
  }),
})

/** The one query parameter of the reply stream: the input, encoded as JSON. */
export const replyStreamQuerySchema = z.strictObject({
  q: z.codec(z.string(), replyInputSchema, {
    decode: (text, context) => {
      try {
        return JSON.parse(text)
      } catch {
        context.issues.push({ code: "invalid_format", format: "json", input: text })
        return z.NEVER
      }
    },
    encode: (input) => JSON.stringify(input),
  }),
})

/**
 * An event of the reply stream. Each agent that speaks sends `start`, `chunk`s and `end`; a
 * sub-agent that takes over sends its own `start`. `notify_client` names a tool being called.
 */
export const replyStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), messageId: z.uuid() }),
  z.object({ type: z.literal("chunk"), messageId: z.uuid(), content: z.string() }),
  z.object({ type: z.literal("notify_client"), toolName: z.string() }),
  z.object({ type: z.literal("end"), messageId: z.uuid(), fullContent: z.string() }),
  z.object({ type: z.literal("error"), messageId: z.uuid().optional(), error: z.string() }),
])

export type ReplyStreamEventDto = z.output<typeof replyStreamEventSchema>

/** The params of the routes under one message. */
export const messageParamsSchema = projectParamsSchema.extend({ agentMessageId: z.uuid() })

/** A problem the person reports on one of the agent's replies. */
export const messageFeedbackInputSchema = z.strictObject({
  content: z.string().trim().min(1).max(2000),
})

export type MessageFeedbackInputDto = z.input<typeof messageFeedbackInputSchema>

/** The files a person can attach to a message. */
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
] as const

/** The largest file a person can attach, as apps/web allows it. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

/** The file to attach, before its upload. */
export const presignAttachmentInputSchema = z.strictObject({
  fileName: z.string().min(1),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES),
  size: z.number().int().positive().max(ATTACHMENT_MAX_BYTES),
})

/** Where to upload the file: a signed URL, valid 15 minutes, that takes a PUT of its bytes. */
export const presignAttachmentOutputSchema = z.object({
  attachmentDocumentId: z.uuid(),
  uploadUrl: z.url(),
})

/** The params of the routes under one attachment of a conversation. */
export const attachmentParamsSchema = conversationParamsSchema.extend({
  attachmentDocumentId: z.uuid(),
})

/** The current HTML of an MCP App a conversation's replies show. */
export const mcpAppHtmlOutputSchema = z.object({
  mcpServerId: z.string(),
  resourceUri: z.string(),
  html: z.string(),
})

export type McpAppHtmlOutputDto = z.output<typeof mcpAppHtmlOutputSchema>

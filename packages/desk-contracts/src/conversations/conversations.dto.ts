import { z } from "zod"

/** The params of the routes under one conversation. */
export const conversationParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentId: z.uuid(),
  agentSessionId: z.uuid(),
})

/** A conversation the signed-in person just started, as `.../create` returns it. */
export const createdConversationOutputSchema = z.object({
  id: z.uuid(),
})

export type CreatedConversationOutputDto = z.output<typeof createdConversationOutputSchema>

/** A tool an agent called while it answered. */
export const toolCallOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
})

/** One message of a conversation, oldest first. `tool` messages hold tool results. */
export const conversationMessageOutputSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  /** Left out on the messages written before statuses existed, which are complete. */
  status: z.enum(["streaming", "completed", "aborted", "error"]).optional(),
  createdAt: z.number().optional(),
  toolCalls: z.array(toolCallOutputSchema).optional(),
})

export type ConversationMessageOutputDto = z.output<typeof conversationMessageOutputSchema>

/** What the reply stream reads from its `q` parameter: the message, as JSON. */
export const replyInputSchema = z.strictObject({
  payload: z.strictObject({ content: z.string().trim().min(1) }),
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
export const messageParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentMessageId: z.uuid(),
})

/** A problem the person reports on one of the agent's replies. */
export const messageFeedbackInputSchema = z.strictObject({
  content: z.string().trim().min(1).max(2000),
})

export type MessageFeedbackInputDto = z.input<typeof messageFeedbackInputSchema>

import { z } from "zod"
import type { TimeType } from "../generic"

/** A thumbs-up on an agent's reply, or a reported problem with it. */
export const agentMessageFeedbackRatingSchema = z.enum(["positive", "negative"])

export type AgentMessageFeedbackRating = z.infer<typeof agentMessageFeedbackRatingSchema>

/**
 * A positive feedback may come with no text. A negative one is a report and needs one. A client
 * that sends no rating reports a problem, as every client did before ratings existed.
 */
export const createAgentMessageFeedbackSchema = z
  .object({
    rating: agentMessageFeedbackRatingSchema.default("negative"),
    content: z.string().trim().default(""),
  })
  .refine((feedback) => feedback.rating === "positive" || feedback.content !== "", {
    path: ["content"],
    message: "A negative feedback needs a content",
  })

export type CreateAgentMessageFeedbackDto = z.input<typeof createAgentMessageFeedbackSchema>

export type AgentMessageFeedbackDto = {
  id: string
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
  agentMessageId: string
  agentMessageContent: string
  traceUrl?: string
  userId: string
  rating: AgentMessageFeedbackRating
  content: string
  createdAt: TimeType
}

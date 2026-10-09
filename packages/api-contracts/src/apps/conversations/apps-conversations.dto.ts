import { z } from "zod"
import type { TimeType } from "../../generic"

/**
 * An agent an App may open conversations with. Only conversation agents of the
 * installation's project are listed.
 */
export type AppAgentDto = {
  id: string
  name: string
}

export const createAppConversationSchema = z
  .object({
    /**
     * Who the App talks for, as an opaque value chosen by the App (for example a
     * salted hash of a phone number). Never a phone number or an email in clear.
     */
    external_user_id: z.string().trim().min(1).max(200),
  })
  .strict()

export type CreateAppConversationRequestDto = z.infer<typeof createAppConversationSchema>

export type AppConversationDto = {
  id: string
  agentId: string
  externalUserId: string | null
  createdAt: TimeType
}

export const sendAppConversationMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(20000),
  })
  .strict()

export type SendAppConversationMessageRequestDto = z.infer<typeof sendAppConversationMessageSchema>

/** The agent's whole reply to one message, after every hand-over between agents. */
export type AppConversationReplyDto = {
  messageId: string
  content: string
}

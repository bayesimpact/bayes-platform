import { conversationFormOutputSchema } from "@caseai-connect/chat-contracts"
import { z } from "zod"

/** A conversation of the signed-in person with a conversation agent, newest first. */
export const conversationSessionOutputSchema = z.object({
  id: z.uuid(),
  /** The API leaves the field out until the conversation gets a title. */
  title: z.string().optional(),
  createdAt: z.number(),
  /** The forms the agents filled in during the conversation. */
  forms: z.array(conversationFormOutputSchema),
})

export type ConversationSessionOutputDto = z.output<typeof conversationSessionOutputSchema>

/** An extraction of one document by an extraction agent. */
export const extractionRunOutputSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  documentFileName: z.string().nullable(),
  status: z.enum(["pending", "success", "failed"]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ExtractionRunOutputDto = z.output<typeof extractionRunOutputSchema>

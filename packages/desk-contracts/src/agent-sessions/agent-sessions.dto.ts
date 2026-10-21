import { z } from "zod"

/** The params of the routes under one agent. */
export const agentParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentId: z.uuid(),
})

/** A conversation of the signed-in person with a conversation agent, newest first. */
export const conversationSessionOutputSchema = z.object({
  id: z.uuid(),
  /** The API leaves the field out until the conversation gets a title. */
  title: z.string().optional(),
  createdAt: z.number(),
})

export type ConversationSessionOutputDto = z.output<typeof conversationSessionOutputSchema>

/** An extraction of one document by an extraction agent. */
export const extractionRunOutputSchema = z.object({
  id: z.uuid(),
  documentFileName: z.string().nullable(),
  status: z.enum(["pending", "success", "failed"]),
  createdAt: z.number(),
})

export type ExtractionRunOutputDto = z.output<typeof extractionRunOutputSchema>

/** An extraction of every row of a CSV file by an extraction agent. */
export const csvExtractionRunOutputSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  createdAt: z.number(),
})

export type CsvExtractionRunOutputDto = z.output<typeof csvExtractionRunOutputSchema>

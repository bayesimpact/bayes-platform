import { z } from "zod"

/** The params of the routes under one agent. */
export const agentParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  agentId: z.uuid(),
})

/** A field of a form, as the agent's form schema describes it. */
const formFieldSchemaSchema = z.object({
  type: z.string().optional(),
  description: z.string().optional(),
})

/** The schema of the form an agent fills in during a conversation. */
export const formSchemaOutputSchema = z.object({
  properties: z.record(z.string(), formFieldSchemaSchema),
  /** The order to show the fields in; the properties' order otherwise. */
  propertyOrdering: z.array(z.string()).optional(),
})

/**
 * The form one agent fills in during a conversation, from what the person tells it: the
 * conversation's agent, or a sub-agent it handed the conversation to.
 */
export const conversationFormOutputSchema = z.object({
  agentId: z.uuid(),
  agentName: z.string().optional(),
  status: z.enum(["in_progress", "concluded"]),
  state: z.record(z.string(), z.unknown()),
  /** Left out when the agent does not fill a form in. */
  outputJsonSchema: formSchemaOutputSchema.optional(),
  updatedAt: z.number(),
})

export type ConversationFormOutputDto = z.output<typeof conversationFormOutputSchema>

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

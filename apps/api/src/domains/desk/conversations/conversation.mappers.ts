import {
  type ConversationFormOutputDto,
  type ConversationSessionOutputDto,
  formSchemaOutputSchema,
} from "@caseai-connect/desk-contracts"
import type { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { toConversationFormDto } from "@/domains/agents/shared/conversation-forms/conversation-form.mapper"

/** A conversation as the history lists it, with its forms and the agent of each form. */
export type ConversationSessionRecord = Awaited<
  ReturnType<ConversationAgentSessionsService["getAllSessionsForAgent"]>
>[number]

/** The current form schema of each agent that has forms in a list of conversations. */
export type FormSchemasByAgentId = Map<string, Record<string, unknown> | null>

/**
 * A conversation of the history, as the Desk reads it. A copy of the `toDto` of
 * `ConversationAgentSessionsController` for a live session, limited to the fields of the contract.
 */
export function toConversationSessionDto(
  session: ConversationSessionRecord,
  formSchemas: FormSchemasByAgentId,
): ConversationSessionOutputDto {
  return {
    id: session.id,
    ...(session.title ? { title: session.title } : {}),
    createdAt: session.createdAt.getTime(),
    // Loaded with the session where the list is built.
    forms: (session.forms ?? []).map((form) =>
      toDeskConversationFormDto(toConversationFormDto(form, formSchemas.get(form.agentId))),
    ),
  }
}

/**
 * The form as the Desk reads it. The agent's schema is free JSON in the API: the Desk reads its
 * `properties` and `propertyOrdering`, so it is parsed with the contract's schema here. A schema
 * that does not fit fails the call, as the response check would.
 */
function toDeskConversationFormDto(
  form: ReturnType<typeof toConversationFormDto>,
): ConversationFormOutputDto {
  const { outputJsonSchema, ...fields } = form
  if (!outputJsonSchema) return fields
  const parsedSchema = formSchemaOutputSchema.safeParse(outputJsonSchema)
  if (!parsedSchema.success) {
    throw new Error(`The form schema of agent ${form.agentId} does not fit the Desk contract`)
  }
  return { ...fields, outputJsonSchema: parsedSchema.data }
}

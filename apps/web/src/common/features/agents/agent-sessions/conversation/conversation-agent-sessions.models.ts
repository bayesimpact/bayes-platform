import type {
  ConversationAgentSessionDto,
  ConversationFormDto,
  ConversationSubSessionDto,
} from "@caseai-connect/api-contracts"

export type ConversationAgentSession = ConversationAgentSessionDto
export type ConversationForm = ConversationFormDto
export type ConversationSubSession = ConversationSubSessionDto

/**
 * The form one agent fills in a conversation, if it has written anything yet.
 * A conversation keeps one form per agent that collected answers in it.
 */
export function findConversationForm(
  session: Pick<ConversationAgentSession, "forms">,
  agentId: string,
): ConversationForm | undefined {
  return session.forms.find((form) => form.agentId === agentId)
}

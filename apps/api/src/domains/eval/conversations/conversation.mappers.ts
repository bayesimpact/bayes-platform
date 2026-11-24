import type { ConversationMessageOutputDto } from "@caseai-connect/eval-contracts"
import { NotFoundException } from "@nestjs/common"
import type {
  EndpointRequestWithConversationAgentSession,
  EndpointRequestWithReviewCampaign,
} from "@/common/context/request.interface"
import type { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import { toDto } from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"

/**
 * The resources a tester's conversation route loads: the session, then its campaign, which the
 * permission is checked on. Another campaign of the same project gives no access to the session.
 */
export const TESTER_SESSION_CONTEXT = [
  "organization",
  "project",
  "agent",
  "agentSession",
  "agentSessionReviewCampaign",
] as const

/** A request with a tester's session and its campaign (the `agentSessionReviewCampaign` context). */
export type EndpointRequestWithTesterSession = EndpointRequestWithConversationAgentSession &
  Pick<EndpointRequestWithReviewCampaign, "reviewCampaign">

/**
 * The routes serve tester sessions only: a session of another type answers 404, as on the routes
 * they copy.
 */
export function assertTesterSession(request: EndpointRequestWithTesterSession): void {
  if (request.agentSession.type !== "review_campaign_tester") throw new NotFoundException()
}

type AgentMessage = Awaited<
  ReturnType<ConversationAgentSessionsService["listMessagesForSession"]>
>[number]

/**
 * A message as Evaluation reads it: the `toDto` of `AgentMessagesController`, limited to the
 * fields of the contract. The revision and the agent of each message stay out.
 */
function toConversationMessageDto(message: AgentMessage): ConversationMessageOutputDto {
  const { id, role, content, status, createdAt, toolCalls, attachmentDocumentId } = toDto(message)
  return { id, role, content, status, createdAt, toolCalls, attachmentDocumentId }
}

export function toConversationMessageDtos(
  messages: AgentMessage[],
): ConversationMessageOutputDto[] {
  return messages.map(toConversationMessageDto)
}

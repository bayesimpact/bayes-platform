import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import type { ConversationAgentSession } from "../conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationReviewRepository } from "./conversation-review.repository"

export type ConversationReview = {
  session: ConversationAgentSession
  messages: AgentMessage[]
}

@Injectable()
export class ConversationReviewService {
  constructor(private readonly conversationReviewRepository: ConversationReviewRepository) {}

  /**
   * A conversation of the agent, live or playground and whoever had it. A session of another
   * agent, project or organization is reported as missing, like an unknown id.
   */
  async getConversationForReview({
    connectScope,
    agentId,
    sessionId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    sessionId: string
  }): Promise<ConversationReview> {
    const session = await this.conversationReviewRepository.findSessionOfAgent(connectScope, {
      agentId,
      sessionId,
    })
    if (!session) throw new NotFoundException("Conversation not found")

    const messages = await this.conversationReviewRepository.listMessagesOfSession(
      connectScope,
      session.id,
    )
    return { session, messages }
  }
}

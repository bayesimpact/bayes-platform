import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  ConversationReviewRepository,
  type ReviewedSession,
  type ReviewSessionListRow,
} from "./conversation-review.repository"

export type ConversationReview = ReviewedSession & { messages: AgentMessage[] }

/** One page of the agent's sessions grouped by category, for the review list. */
export type ReviewSessionPage = {
  rows: ReviewSessionListRow[]
  total: number
  page: number
  limit: number
}

@Injectable()
export class ConversationReviewService {
  constructor(private readonly conversationReviewRepository: ConversationReviewRepository) {}

  /**
   * A session of the agent, whatever its kind (Studio conversation, public session, extraction
   * run) and whoever had it. A session of another agent, project or organization is reported as
   * missing, like an unknown id.
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
    const reviewed = await this.conversationReviewRepository.findSessionOfAgent(connectScope, {
      agentId,
      sessionId,
    })
    if (!reviewed) throw new NotFoundException("Conversation not found")

    // An extraction run keeps its prompt and result on the session, not in messages.
    const messages =
      reviewed.kind === "extraction"
        ? []
        : await this.conversationReviewRepository.listMessagesOfSession(
            connectScope,
            reviewed.session.id,
          )
    return { ...reviewed, messages }
  }

  /**
   * The agent's sessions grouped by category, for the review list: conversation sessions and
   * public embed/app sessions the category tagged, or the ones no category tagged when
   * `categoryId` is null. Newest first, paginated.
   */
  async listSessionsForReview({
    connectScope,
    agentId,
    categoryId,
    page,
    limit,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    /** A project category id, or null to list the sessions no category tagged. */
    categoryId: string | null
    page: number
    limit: number
  }): Promise<ReviewSessionPage> {
    const { rows, total } = await this.conversationReviewRepository.listSessionsOfAgentByCategory(
      connectScope,
      { agentId, categoryId, limit, offset: (page - 1) * limit },
    )
    return { rows, total, page, limit }
  }
}

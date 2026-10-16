import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import { ConversationAgentSession } from "../conversation-agent-session.entity"

/**
 * Read-only access to any conversation of an agent, whoever had it. Unlike the session context
 * resolver, the lookup is not narrowed to the caller's own sessions: the route that uses it is
 * gated by the `agent.conversation.review` permission.
 */
@Injectable()
export class ConversationReviewRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findSessionOfAgent(
    connectScope: RequiredConnectScope,
    { agentId, sessionId }: { agentId: string; sessionId: string },
  ): Promise<ConversationAgentSession | null> {
    const [session] = await this.sessionConnectRepo().find(connectScope, {
      where: { id: sessionId, agentId },
      take: 1,
    })
    return session ?? null
  }

  /** Oldest first. Settles nothing: a review never writes to the conversation it reads. */
  listMessagesOfSession(
    connectScope: RequiredConnectScope,
    sessionId: string,
  ): Promise<AgentMessage[]> {
    return this.messageConnectRepo().find(connectScope, {
      where: { sessionId },
      order: { createdAt: "ASC" },
    })
  }

  private sessionConnectRepo(): ConnectRepository<ConversationAgentSession> {
    return new ConnectRepository(this.sessionRepo(), "conversationAgentSession")
  }

  private messageConnectRepo(): ConnectRepository<AgentMessage> {
    return new ConnectRepository(this.messageRepo(), "agentMessage")
  }

  private sessionRepo(): Repository<ConversationAgentSession> {
    return this.transactionService.getManager().getRepository(ConversationAgentSession)
  }

  private messageRepo(): Repository<AgentMessage> {
    return this.transactionService.getManager().getRepository(AgentMessage)
  }
}

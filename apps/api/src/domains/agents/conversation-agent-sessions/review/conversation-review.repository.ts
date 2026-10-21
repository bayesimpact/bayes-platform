import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { ExtractionAgentSession } from "../../extraction-agent-sessions/extraction-agent-session.entity"
import { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import { ConversationAgentSession } from "../conversation-agent-session.entity"

/**
 * The columns of a public session that the review shows. Loaded by entity name: importing the
 * PublicAgentSession entity here would be a cross-domain entity import
 * (no-cross-domain-entity-import), and the public-chat module already imports this one.
 */
export type PublicSessionRecord = {
  id: string
  agentId: string
  organizationId: string
  projectId: string
  appInstallationId: string | null
  externalVisitorId: string | null
  title: string | null
  purgedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** A session of any kind, as the review reads it. */
export type ReviewedSession =
  | { kind: "conversation"; session: ConversationAgentSession }
  | { kind: "public"; session: PublicSessionRecord }
  | { kind: "extraction"; session: ExtractionAgentSession }

/**
 * Read-only access to any session of an agent, whoever had it. Unlike the session context
 * resolver, the lookup is not narrowed to the caller's own sessions: the route that uses it is
 * gated by the `agent.conversation.review` permission.
 */
@Injectable()
export class ConversationReviewRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * The three session tables share the id space of `agent_message.session_id`: the id names one
   * session at most, so the first table that has it wins.
   */
  async findSessionOfAgent(
    connectScope: RequiredConnectScope,
    { agentId, sessionId }: { agentId: string; sessionId: string },
  ): Promise<ReviewedSession | null> {
    const [conversationSession] = await this.conversationSessionConnectRepo().find(connectScope, {
      where: { id: sessionId, agentId },
      take: 1,
    })
    if (conversationSession) return { kind: "conversation", session: conversationSession }

    // Not a connect entity: the scope is matched on its own organization and project columns.
    const publicSession = await this.publicSessionRepo().findOne({
      where: {
        id: sessionId,
        agentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
    if (publicSession) return { kind: "public", session: publicSession }

    const [extractionSession] = await this.extractionSessionConnectRepo().find(connectScope, {
      where: { id: sessionId, agentId },
      relations: { document: true },
      take: 1,
    })
    if (extractionSession) return { kind: "extraction", session: extractionSession }

    return null
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

  private conversationSessionConnectRepo(): ConnectRepository<ConversationAgentSession> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(ConversationAgentSession),
      "conversationAgentSession",
    )
  }

  private extractionSessionConnectRepo(): ConnectRepository<ExtractionAgentSession> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(ExtractionAgentSession),
      "extractionAgentSession",
    )
  }

  private messageConnectRepo(): ConnectRepository<AgentMessage> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(AgentMessage),
      "agentMessage",
    )
  }

  private publicSessionRepo(): Repository<PublicSessionRecord> {
    return this.transactionService
      .getManager()
      .getRepository<PublicSessionRecord>("PublicAgentSession")
  }
}

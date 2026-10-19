import { Injectable } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { Agent } from "../agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionRepository } from "../conversation-agent-sessions/conversation-agent-session.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionRepository } from "../extraction-agent-sessions/extraction-agent-session.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageRepository } from "../shared/agent-session-messages/agent-message.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationFormRepository } from "../shared/conversation-forms/conversation-form.repository"

@Injectable()
export class BaseAgentSessionsService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly agentMessageRepository: AgentMessageRepository,
    private readonly conversationFormRepository: ConversationFormRepository,
    private readonly conversationAgentSessionRepository: ConversationAgentSessionRepository,
    private readonly extractionAgentSessionRepository: ExtractionAgentSessionRepository,
  ) {}

  /**
   * Deletes a session with its messages, their feedback and its forms. A conversation also takes
   * the relay sub-sessions it spawned, with their content: they are part of that conversation.
   */
  async deleteAgentSession({
    connectScope,
    agentType,
    agentId,
    agentSessionId,
  }: {
    connectScope: RequiredConnectScope
    agentType: Agent["type"]
    agentId: string
    agentSessionId: string
  }): Promise<void> {
    await this.transactionService.run(async () => {
      const subSessionIds =
        agentType === "conversation"
          ? await this.conversationAgentSessionRepository.findSubSessionIds(
              connectScope,
              agentSessionId,
            )
          : []
      const sessionIds = [agentSessionId, ...subSessionIds]
      await this.agentMessageRepository.deleteForSessions(connectScope, sessionIds)
      await this.conversationFormRepository.deleteForSessions(connectScope, sessionIds)

      if (agentType === "extraction") {
        await this.extractionAgentSessionRepository.deleteSession(connectScope, {
          agentId,
          sessionId: agentSessionId,
        })
        return
      }
      await this.conversationAgentSessionRepository.deleteSubSessions(connectScope, subSessionIds)
      await this.conversationAgentSessionRepository.deleteSession(connectScope, {
        agentId,
        sessionId: agentSessionId,
      })
    })
  }
}

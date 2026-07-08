import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { EntityManager, EntityTarget } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import type { Agent } from "../agent.entity"
import { ConversationAgentSession } from "../conversation-agent-sessions/conversation-agent-session.entity"
import { ExtractionAgentSession } from "../extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "../form-agent-sessions/form-agent-session.entity"
import { AgentMessage } from "../shared/agent-session-messages/agent-message.entity"
import { AgentMessageFeedback } from "../shared/agent-session-messages/feedback/agent-message-feedback.entity"

type AgentSession = ConversationAgentSession | FormAgentSession | ExtractionAgentSession

const sessionEntityByType: Record<Agent["type"], EntityTarget<AgentSession>> = {
  conversation: ConversationAgentSession,
  form: FormAgentSession,
  extraction: ExtractionAgentSession,
} as const

@Injectable()
export class BaseAgentSessionsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async deleteAgentSession({
    agentType,
    agentId,
    agentSession,
  }: {
    agentType: Agent["type"]
    agentId: string
    agentSession: AgentSession
  }): Promise<void> {
    await this.dataSource.transaction(async (entityManager) => {
      await this.deleteSessionMessages({ entityManager, sessionId: agentSession.id })
      await entityManager.delete(sessionEntityByType[agentType] as EntityTarget<AgentSession>, {
        agentId,
        id: agentSession.id,
      })
    })
  }

  private async deleteSessionMessages({
    entityManager,
    sessionId,
  }: {
    entityManager: EntityManager
    sessionId: string
  }): Promise<void> {
    const agentMessages = await entityManager.find(AgentMessage, {
      where: { sessionId },
      select: { id: true },
    })
    for (const agentMessage of agentMessages) {
      await entityManager.delete(AgentMessageFeedback, { agentMessageId: agentMessage.id })
    }
    await entityManager.delete(AgentMessage, { sessionId })
  }
}

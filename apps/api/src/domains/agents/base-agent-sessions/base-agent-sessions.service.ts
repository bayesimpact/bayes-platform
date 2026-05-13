import { Injectable } from "@nestjs/common"
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
  constructor(private readonly dataSource: DataSource) {}

  async deleteAgentSessions({
    entityManager,
    agentId,
    agentType,
  }: {
    entityManager: EntityManager
    agentId: string
    agentType: Agent["type"]
  }): Promise<void> {
    const sessions = await this.getAllSessions({ entityManager, agentId, agentType })

    for (const session of sessions) {
      await this.deleteSessionMessages({ entityManager, sessionId: session.id })
    }

    await entityManager.delete(sessionEntityByType[agentType] as EntityTarget<AgentSession>, {
      agentId,
    })
  }

  async getSessionById({
    entityManager,
    agentId,
    agentType,
    sessionId,
    userId,
  }: {
    entityManager: EntityManager
    agentId: string
    agentType: Agent["type"]
    sessionId: string
    userId: string
  }): Promise<AgentSession | null> {
    return entityManager.findOne(sessionEntityByType[agentType] as EntityTarget<AgentSession>, {
      where: { agentId, id: sessionId, userId },
      select: { id: true },
    })
  }

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

  private async getAllSessions({
    entityManager,
    agentId,
    agentType,
  }: {
    entityManager: EntityManager
    agentId: string
    agentType: Agent["type"]
  }): Promise<{ id: string }[]> {
    return entityManager.find(sessionEntityByType[agentType] as EntityTarget<AgentSession>, {
      where: { agentId },
      select: { id: true },
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

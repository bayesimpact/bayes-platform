import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { v4 } from "uuid"

import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "../agent.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import type { AgentSessionCategory } from "../session-categories/agent-session-category.entity"
import { AgentMessage } from "../shared/agent-session-messages/agent-message.entity"
import { ConversationAgentSession } from "./conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "./conversation-agent-session-category.entity"

const MAX_AUTO_SESSION_CATEGORIES = 5

@Injectable()
export class ConversationAgentSessionsService {
  private readonly conversationAgentSessionConnectRepository: ConnectRepository<ConversationAgentSession>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>
  private readonly agentConnectRepository: ConnectRepository<Agent>
  private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>
  private readonly conversationAgentSessionCategoryRepository: Repository<ConversationAgentSessionCategory>

  constructor(
    @InjectRepository(ConversationAgentSession)
    conversationAgentSessionRepository: Repository<ConversationAgentSession>,

    @InjectRepository(AgentMessage)
    agentMessageRepository: Repository<AgentMessage>,

    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,
    @InjectRepository(ConversationAgentSessionCategory)
    conversationAgentSessionCategoryRepository: Repository<ConversationAgentSessionCategory>,
  ) {
    this.conversationAgentSessionConnectRepository = new ConnectRepository(
      conversationAgentSessionRepository,
      "conversationAgentSession",
    )
    this.agentMessageConnectRepository = new ConnectRepository(
      agentMessageRepository,
      "agentMessage",
    )
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agents")
    this.conversationAgentSessionRepository = conversationAgentSessionRepository
    this.conversationAgentSessionCategoryRepository = conversationAgentSessionCategoryRepository
  }

  async listMessagesForSession({
    agentSessionId,
    connectScope,
  }: {
    agentSessionId: string
    connectScope: RequiredConnectScope
  }): Promise<AgentMessage[]> {
    return this.agentMessageConnectRepository.find(connectScope, {
      where: { sessionId: agentSessionId },
      order: { createdAt: "ASC" },
    })
  }

  async getMessageById({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<AgentMessage | null> {
    return this.agentMessageConnectRepository.getOneById(connectScope, id)
  }

  async getAllSessionsForAgent({
    connectScope,
    agentId,
    userId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    userId: string
    type: BaseAgentSessionType
  }): Promise<ConversationAgentSession[]> {
    return await this.conversationAgentSessionConnectRepository.find(connectScope, {
      where: { agentId, userId, type },
      order: { createdAt: "DESC" },
    })
  }

  async createSession({
    connectScope,
    agentId,
    userId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    userId: string
    type: BaseAgentSessionType
  }): Promise<ConversationAgentSession> {
    const agent = await this.agentConnectRepository.getOneById(connectScope, agentId)
    if (!agent) throw new NotFoundException(`Agent with id ${agentId} not found`)

    const session = await this.conversationAgentSessionConnectRepository.createAndSave(
      connectScope,
      {
        agentId,
        userId,
        type,
        expiresAt: null,
        traceId: v4(),
      },
    )

    const greetingMessage = agent.greetingMessage
    if (greetingMessage && greetingMessage.trim().length > 0) {
      const now = new Date()
      await this.agentMessageConnectRepository.createAndSave(connectScope, {
        sessionId: session.id,
        role: "assistant",
        content: greetingMessage,
        status: "completed",
        startedAt: now,
        completedAt: now,
      })
    }

    return session
  }

  async findById({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<ConversationAgentSession | null> {
    return await this.conversationAgentSessionConnectRepository.getOneById(connectScope, id)
  }

  async getCurrentCategoryNamesForSession({
    connectScope,
    sessionId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
  }): Promise<string[]> {
    const session = await this.conversationAgentSessionRepository.findOne({
      where: {
        id: sessionId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      relations: {
        sessionCategories: { agentSessionCategory: true },
      },
      order: {
        sessionCategories: { createdAt: "ASC" },
      },
    })

    if (!session) {
      throw new NotFoundException(`ConversationAgentSession with id ${sessionId} not found`)
    }

    return session.sessionCategories.map(
      (sessionCategory) => sessionCategory.agentSessionCategory.name,
    )
  }

  async recalculateSessionMetadataFromMessages({
    connectScope,
    sessionId,
    selectedCategoryNames,
    suggestedTitle,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    selectedCategoryNames: string[]
    suggestedTitle: string | null
  }): Promise<{ suggestedTitle: string | null; selectedCategoryNames: string[] }> {
    const session = await this.conversationAgentSessionRepository.findOne({
      where: {
        id: sessionId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
      relations: {
        agent: { sessionCategories: true },
      },
    })

    if (!session) {
      throw new NotFoundException(`ConversationAgentSession with id ${sessionId} not found`)
    }

    const selectedCategories = this.selectCategoriesByName({
      requestedCategoryNames: selectedCategoryNames,
      categories: session.agent.sessionCategories ?? [],
    })

    await this.replaceSessionCategories({
      sessionId: session.id,
      selectedCategories,
    })
    await this.updateSessionTitle({
      session,
      suggestedTitle,
    })

    return {
      suggestedTitle: session.title,
      selectedCategoryNames: selectedCategories.map((category) => category.name),
    }
  }

  private selectCategoriesByName({
    requestedCategoryNames,
    categories,
  }: {
    requestedCategoryNames: string[]
    categories: AgentSessionCategory[]
  }): AgentSessionCategory[] {
    if (categories.length === 0 || requestedCategoryNames.length === 0) {
      return []
    }

    const categoryByName = new Map(
      categories.map((category) => [category.name.toLowerCase(), category] as const),
    )

    const normalizedUniqueRequestedCategoryNames = [
      ...new Set(
        requestedCategoryNames.map((requestedCategoryName) =>
          requestedCategoryName.trim().toLowerCase(),
        ),
      ),
    ]

    return normalizedUniqueRequestedCategoryNames
      .map((normalizedCategoryName) => categoryByName.get(normalizedCategoryName))
      .filter((category): category is AgentSessionCategory => category !== undefined)
      .slice(0, MAX_AUTO_SESSION_CATEGORIES)
  }

  private async replaceSessionCategories({
    sessionId,
    selectedCategories,
  }: {
    sessionId: string
    selectedCategories: AgentSessionCategory[]
  }): Promise<void> {
    await this.conversationAgentSessionCategoryRepository.delete({
      conversationAgentSessionId: sessionId,
    })

    if (selectedCategories.length > 0) {
      await this.conversationAgentSessionCategoryRepository.save(
        selectedCategories.map((selectedCategory) =>
          this.conversationAgentSessionCategoryRepository.create({
            conversationAgentSessionId: sessionId,
            agentSessionCategoryId: selectedCategory.id,
          }),
        ),
      )
    }
  }

  private async updateSessionTitle({
    session,
    suggestedTitle,
  }: {
    session: ConversationAgentSession
    suggestedTitle: string | null
  }): Promise<void> {
    const nextTitle = suggestedTitle?.trim() || null
    if (session.title === nextTitle) {
      return
    }
    session.title = nextTitle
    await this.conversationAgentSessionRepository.save(session)
  }
}

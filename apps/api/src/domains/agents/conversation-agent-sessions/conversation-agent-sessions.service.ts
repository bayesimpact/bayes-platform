import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { IsNull, type Repository } from "typeorm"
import { v4 } from "uuid"

import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
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
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>
  private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>
  private readonly conversationAgentSessionCategoryRepository: Repository<ConversationAgentSessionCategory>

  constructor(
    @InjectRepository(ConversationAgentSession)
    conversationAgentSessionRepository: Repository<ConversationAgentSession>,

    @InjectRepository(AgentMessage)
    agentMessageRepository: Repository<AgentMessage>,

    @InjectRepository(AgentSettings)
    agentSettingsRepository: Repository<AgentSettings>,
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
    this.agentSettingsConnectRepository = new ConnectRepository(
      agentSettingsRepository,
      "agentSettings",
    )
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
      // Exclude sub-sessions (those with a parent session): these are internal
      // artifacts created when a parent agent delegates to this conversation
      // agent, not user-facing sessions.
      where: { agentId, userId, type, parentSessionId: IsNull() },
      order: { createdAt: "DESC" },
    })
  }

  /**
   * Finds the conversation sub-session spawned by a parent agent session for a
   * given conversation sub-agent, or creates it if it does not exist yet. A
   * single sub-session is reused across parent turns so the sub-agent's runs all
   * land in one persistent trace.
   */
  async findOrCreateSubSession({
    connectScope,
    agentId,
    userId,
    parentSessionId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    userId: string
    parentSessionId: string
    type: BaseAgentSessionType
  }): Promise<ConversationAgentSession> {
    const existing = await this.conversationAgentSessionConnectRepository.find(connectScope, {
      where: { agentId, parentSessionId, type },
      take: 1,
    })
    if (existing[0]) return existing[0]

    return this.conversationAgentSessionConnectRepository.createAndSave(connectScope, {
      agentId,
      userId,
      type,
      parentSessionId,
      expiresAt: null,
      traceId: v4(),
    })
  }

  async createSession({
    connectScope,
    agentSettingsId,
    userId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentSettingsId: string
    userId: string
    type: BaseAgentSessionType
  }): Promise<ConversationAgentSession> {
    const agentSettings = await this.agentSettingsConnectRepository.getOneById(
      connectScope,
      agentSettingsId,
    )
    if (!agentSettings)
      throw new NotFoundException(`AgentSettings with id ${agentSettingsId} not found`)

    const session = await this.conversationAgentSessionConnectRepository.createAndSave(
      connectScope,
      {
        agentId: agentSettings.agentId,
        userId,
        type,
        expiresAt: null,
        traceId: v4(),
      },
    )

    const greetingMessage = agentSettings.greetingMessage
    if (greetingMessage && greetingMessage.trim().length > 0) {
      const now = new Date()
      await this.agentMessageConnectRepository.createAndSave(
        connectScope,

        {
          sessionId: session.id,
          agentSettingsId: agentSettings.id,
          role: "assistant",
          content: greetingMessage,
          status: "completed",
          startedAt: now,
          completedAt: now,
        },
      )
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

  /**
   * Lists the sub-sessions spawned by a given parent agent session. These are
   * the persistent sessions created when a parent agent delegates to a
   * sub-agent (see {@link findOrCreateSubSession}). Scoped to the requesting
   * user to match {@link getAllSessionsForAgent} visibility.
   */
  async listSubSessions({
    connectScope,
    parentSessionId,
    userId,
    type,
  }: {
    connectScope: RequiredConnectScope
    parentSessionId: string
    userId: string
    type: BaseAgentSessionType
  }): Promise<ConversationAgentSession[]> {
    return this.conversationAgentSessionConnectRepository.find(connectScope, {
      where: { parentSessionId, userId, type },
      order: { createdAt: "ASC" },
    })
  }

  /**
   * Merges the given fillForm input into the session's accumulated form state.
   */
  async updateSessionResult({
    connectScope,
    input,
    sessionId,
  }: {
    connectScope: RequiredConnectScope
    input: Record<string, unknown>
    sessionId: string
  }): Promise<{ result: Record<string, unknown> | null }> {
    const session = await this.conversationAgentSessionConnectRepository.getOneById(
      connectScope,
      sessionId,
    )
    if (!session) return { result: null }

    session.result = { ...session.result, ...input } // mergedResult

    const updatedSession = await this.conversationAgentSessionConnectRepository.saveOne(session)

    return { result: updatedSession.result }
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

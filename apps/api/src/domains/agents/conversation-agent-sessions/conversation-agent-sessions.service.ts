import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, IsNull, type Repository } from "typeorm"
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

  /**
   * Lists a session's messages, merged in chronological order with the messages of any
   * sub-session it has spawned (see findOrCreateSubSession). A relay-mode sub-agent's
   * one-shot completions never get their own AgentMessage rows, so this only actually pulls
   * in extra messages for a handoff sub-agent's own real conversation turns — the merge is
   * what makes a handoff read as one continuous conversation in the Studio chat view.
   */
  async listMessagesForSession({
    agentSessionId,
    connectScope,
  }: {
    agentSessionId: string
    connectScope: RequiredConnectScope
  }): Promise<AgentMessage[]> {
    const subSessionIds = await this.listSubSessionIds({
      connectScope,
      parentSessionId: agentSessionId,
    })

    return this.agentMessageConnectRepository.find(connectScope, {
      where: { sessionId: In([agentSessionId, ...subSessionIds]) },
      order: { createdAt: "ASC" },
      // Joined so the DTO can report the revision that produced each message.
      relations: { agentSettings: true },
    })
  }

  /**
   * Ids of every sub-session spawned from a parent session, used to fold their message
   * threads into the parent's transcript in {@link listMessagesForSession}.
   */
  private async listSubSessionIds({
    connectScope,
    parentSessionId,
  }: {
    connectScope: RequiredConnectScope
    parentSessionId: string
  }): Promise<string[]> {
    const subSessions = await this.conversationAgentSessionConnectRepository.find(connectScope, {
      where: { parentSessionId },
    })
    return subSessions.map((subSession) => subSession.id)
  }

  /**
   * `agentId` + `result` for every sub-session spawned from a parent session
   * (see `findOrCreateSubSession`). Used by `ToolsService` to tell an
   * orchestrating agent what its handoff-mode sub-agents have produced —
   * the orchestrator's own turn never otherwise sees a handoff child's
   * session, since the end user talks to it directly (see AgentSubAgentMode).
   */
  async listSubSessionResults({
    connectScope,
    parentSessionId,
  }: {
    connectScope: RequiredConnectScope
    parentSessionId: string
  }): Promise<Array<{ agentId: string; result: Record<string, unknown> | null }>> {
    const subSessions = await this.conversationAgentSessionConnectRepository.find(connectScope, {
      where: { parentSessionId },
    })
    return subSessions.map((subSession) => ({
      agentId: subSession.agentId,
      result: subSession.result ?? null,
    }))
  }

  async getMessageById({
    id,
    connectScope,
  }: {
    id: string
    connectScope: RequiredConnectScope
  }): Promise<AgentMessage | null> {
    // `getOneById` builds a query builder, so relations are named as strings here — unlike
    // the `find` above, which forwards TypeORM's object-form FindManyOptions.
    return this.agentMessageConnectRepository.getOneById(connectScope, id, {
      relations: ["agentSettings"],
    })
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
  /**
   * The sub-session a parent has previously spawned for this child agent, if any —
   * without creating one. Used to tell a brand-new handoff from a resumed/already-
   * concluded one (see {@link findOrCreateSubSession} and `runHandoffTool`).
   */
  async findSubSession({
    connectScope,
    agentId,
    parentSessionId,
    type,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    parentSessionId: string
    type: BaseAgentSessionType
  }): Promise<ConversationAgentSession | null> {
    const existing = await this.conversationAgentSessionConnectRepository.find(connectScope, {
      where: { agentId, parentSessionId, type },
      take: 1,
    })
    return existing[0] ?? null
  }

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
    const existing = await this.findSubSession({ connectScope, agentId, parentSessionId, type })
    if (existing) return existing

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

    const mergedResult = { ...session.result, ...input }
    // Scoped to the `result` column only (not a full-entity save): a handoff
    // sub-agent's fillForm call can land in the same step as its own
    // concludeHandoff call (the AI SDK runs a step's tool calls concurrently),
    // so a full save here could stomp a concludeHandoff clear of activeAgentId
    // that committed in between this read and this write.
    await this.conversationAgentSessionConnectRepository.updateManyBy({
      connectScope,
      where: { id: sessionId },
      // TypeORM's QueryDeepPartialEntity can't express a jsonb Record<string, unknown>
      // column as a plain value; the runtime UPDATE is a simple column assignment.
      fields: { result: mergedResult as never },
    })

    return { result: mergedResult }
  }

  /**
   * Sets which agent currently handles a session's turns (a handoff sub-agent taking
   * control). No-op if the session does not exist.
   */
  async setActiveAgent({
    connectScope,
    sessionId,
    activeAgentId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    activeAgentId: string
  }): Promise<void> {
    await this.conversationAgentSessionConnectRepository.updateManyBy({
      connectScope,
      where: { id: sessionId },
      fields: { activeAgentId },
    })
  }

  /**
   * Clears a session's active agent, but only if it still matches the expected agent —
   * guards against clobbering a more recent handoff decided in the meantime. Done as a
   * single conditional UPDATE (not a fetch-then-save) so the check and the write are
   * atomic — a fetch-then-save here previously left a window where a concurrently
   * running tool call (same step, see updateSessionResult) could re-fetch the
   * pre-clear row and later overwrite this clear with a full-entity save.
   */
  async clearActiveAgentIfCurrent({
    connectScope,
    sessionId,
    expectedActiveAgentId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    expectedActiveAgentId: string
  }): Promise<void> {
    await this.conversationAgentSessionConnectRepository.updateManyBy({
      connectScope,
      where: { id: sessionId, activeAgentId: expectedActiveAgentId },
      fields: { activeAgentId: null },
    })
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
      connectScope,
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
    connectScope,
    session,
    suggestedTitle,
  }: {
    connectScope: RequiredConnectScope
    session: ConversationAgentSession
    suggestedTitle: string | null
  }): Promise<void> {
    const nextTitle = suggestedTitle?.trim() || null
    if (session.title === nextTitle) {
      return
    }
    // Scoped to the `title` column only. This ran as a full-entity save
    // (`repository.save(session)`) against a session object fetched at the
    // top of recalculateSessionMetadataFromMessages — since the AI SDK
    // executes a step's tool calls concurrently, a handoff sub-agent calling
    // concludeHandoff in the same step could clear activeAgentId in between
    // that fetch and this save, and the full save would silently write the
    // stale (pre-clear) activeAgentId back, leaving control stuck on the
    // concluded sub-agent for the rest of the conversation.
    await this.conversationAgentSessionConnectRepository.updateManyBy({
      connectScope,
      where: { id: session.id },
      fields: { title: nextTitle },
    })
  }
}

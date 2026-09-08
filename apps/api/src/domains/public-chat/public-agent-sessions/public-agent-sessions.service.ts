import crypto from "node:crypto"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { recoverAbortedStreams } from "@/domains/agents/shared/agent-session-messages/stream-recovery"
import type { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import { PublicAgentSession } from "./public-agent-session.entity"
import { PublicAgentSessionCategory } from "./public-agent-session-category.entity"

@Injectable()
export class PublicAgentSessionsService {
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>

  constructor(
    @InjectRepository(PublicAgentSession)
    private readonly publicAgentSessionRepository: Repository<PublicAgentSession>,
    @InjectRepository(AgentMessage)
    private readonly agentMessageRepository: Repository<AgentMessage>,
    @InjectRepository(PublicAgentSessionCategory)
    private readonly publicAgentSessionCategoryRepository: Repository<PublicAgentSessionCategory>,
    @InjectRepository(AgentSessionCategory)
    private readonly agentSessionCategoryRepository: Repository<AgentSessionCategory>,
    private readonly agentSettingsService: AgentSettingsService,
  ) {
    this.agentMessageConnectRepository = new ConnectRepository(
      agentMessageRepository,
      "agentMessage",
    )
  }

  /**
   * SessionMetadataRecalculator implementation for PUBLIC sessions — same
   * semantics as ConversationAgentSessionsService, keyed on
   * public_agent_session (+ public_agent_session_category for analytics).
   */
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
    const session = await this.publicAgentSessionRepository.findOne({
      where: {
        id: sessionId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
    if (!session) {
      throw new NotFoundException(`PublicAgentSession with id ${sessionId} not found`)
    }

    const agentCategories = await this.agentSessionCategoryRepository.find({
      where: { agentId: session.agentId },
    })
    const categoryByName = new Map(
      agentCategories.map((category) => [category.name.toLowerCase(), category] as const),
    )
    const selectedCategories = [
      ...new Set(selectedCategoryNames.map((name) => name.trim().toLowerCase())),
    ]
      .map((normalizedName) => categoryByName.get(normalizedName))
      .filter((category): category is AgentSessionCategory => category !== undefined)

    await this.publicAgentSessionCategoryRepository.delete({ publicAgentSessionId: session.id })
    if (selectedCategories.length > 0) {
      await this.publicAgentSessionCategoryRepository.save(
        selectedCategories.map((category) =>
          this.publicAgentSessionCategoryRepository.create({
            publicAgentSessionId: session.id,
            agentSessionCategoryId: category.id,
          }),
        ),
      )
    }

    const nextTitle = suggestedTitle?.trim() || null
    if (session.title !== nextTitle) {
      session.title = nextTitle
      await this.publicAgentSessionRepository.save(session)
    }

    return {
      suggestedTitle: session.title,
      selectedCategoryNames: selectedCategories.map((category) => category.name),
    }
  }

  /**
   * SessionResultUpdater implementation for PUBLIC sessions: merges the
   * fillForm fields into public_agent_session.result.
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
    const session = await this.publicAgentSessionRepository.findOne({
      where: {
        id: sessionId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
    if (!session) return { result: null }

    session.result = { ...session.result, ...input }
    const updatedSession = await this.publicAgentSessionRepository.save(session)
    return { result: updatedSession.result }
  }

  async createSession(
    embedConfig: AgentEmbedConfig,
    externalVisitorId?: string,
  ): Promise<{ session: PublicAgentSession; sessionToken: string }> {
    const sessionToken = crypto.randomUUID()
    const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

    // The greeting and the session config come from the published settings, not from
    // the draft an author is editing in the agent editor (#636).
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope: {
        organizationId: embedConfig.organizationId,
        projectId: embedConfig.projectId,
      },
      agentId: embedConfig.agentId,
    })

    const session = this.publicAgentSessionRepository.create({
      embedConfigId: embedConfig.id,
      agentId: embedConfig.agentId,
      organizationId: embedConfig.organizationId,
      projectId: embedConfig.projectId,
      sessionTokenHash,
      externalVisitorId: externalVisitorId ?? null,
      lastActivityAt: new Date(),
    })

    const savedSession = await this.publicAgentSessionRepository.save(session)

    if (agentSettings.greetingMessage?.trim()) {
      const now = new Date()
      await this.agentMessageRepository.save(
        this.agentMessageRepository.create({
          sessionId: savedSession.id,
          organizationId: embedConfig.organizationId,
          projectId: embedConfig.projectId,
          agentSettingsId: agentSettings.id,
          role: "assistant",
          content: agentSettings.greetingMessage,
          status: "completed",
          startedAt: now,
          completedAt: now,
        }),
      )
    }

    return { session: savedSession, sessionToken }
  }

  async findByTokenHash(sessionTokenHash: string): Promise<PublicAgentSession | null> {
    return this.publicAgentSessionRepository.findOne({ where: { sessionTokenHash } })
  }

  async getSessionWithMessages(
    sessionId: string,
  ): Promise<{ session: PublicAgentSession; messages: AgentMessage[] }> {
    const session = await this.publicAgentSessionRepository.findOne({ where: { id: sessionId } })
    if (!session) throw new NotFoundException("Session not found")

    await recoverAbortedStreams({
      agentMessageConnectRepository: this.agentMessageConnectRepository,
      connectScope: { organizationId: session.organizationId, projectId: session.projectId },
      sessionId,
    })

    const messages = await this.agentMessageRepository.find({
      where: { sessionId },
      order: { createdAt: "ASC" },
    })

    return { session, messages }
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    await this.publicAgentSessionRepository.update(sessionId, { lastActivityAt: new Date() })
  }
}

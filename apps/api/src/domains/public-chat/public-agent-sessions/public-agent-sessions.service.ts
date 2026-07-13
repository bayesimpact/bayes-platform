import crypto from "node:crypto"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import type { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import { PublicAgentSession } from "./public-agent-session.entity"

const STREAM_TIMEOUT_MS = 5 * 60 * 1000

@Injectable()
export class PublicAgentSessionsService {
  constructor(
    @InjectRepository(PublicAgentSession)
    private readonly publicAgentSessionRepository: Repository<PublicAgentSession>,
    @InjectRepository(AgentMessage)
    private readonly agentMessageRepository: Repository<AgentMessage>,
    @InjectRepository(AgentSettings)
    private readonly agentSettingsRepository: Repository<AgentSettings>,
  ) {}

  async createSession(
    embedConfig: AgentEmbedConfig,
    externalVisitorId?: string,
  ): Promise<{ session: PublicAgentSession; sessionToken: string }> {
    const sessionToken = crypto.randomUUID()
    const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

    const agentSettings = await this.agentSettingsRepository.findOne({
      where: { agentId: embedConfig.agentId },
      order: { revision: "DESC" }, //findOne + order DESC to get last revision
    })
    if (!agentSettings)
      throw new NotFoundException(
        `AgentSettings for Agent with id ${embedConfig.agentId} not found`,
      )

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

    await this.recoverAbortedMessages(sessionId)

    const messages = await this.agentMessageRepository.find({
      where: { sessionId },
      order: { createdAt: "ASC" },
    })

    return { session, messages }
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    await this.publicAgentSessionRepository.update(sessionId, { lastActivityAt: new Date() })
  }

  private async recoverAbortedMessages(sessionId: string): Promise<void> {
    const streamingMessages = await this.agentMessageRepository.find({
      where: { sessionId, status: "streaming" },
    })

    const now = Date.now()
    const timedOutMessages = streamingMessages.filter(
      (message) => message.startedAt && now - message.startedAt.getTime() > STREAM_TIMEOUT_MS,
    )

    if (timedOutMessages.length > 0) {
      await this.agentMessageRepository.save(
        timedOutMessages.map((message) => Object.assign(message, { status: "aborted" as const })),
      )
    }
  }
}

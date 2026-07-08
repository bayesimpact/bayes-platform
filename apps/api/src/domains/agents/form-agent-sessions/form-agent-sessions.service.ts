import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { IsNull, type Repository } from "typeorm"
import { v4 } from "uuid"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import { AgentMessage } from "../shared/agent-session-messages/agent-message.entity"
import { FormAgentSession } from "./form-agent-session.entity"

@Injectable()
export class FormAgentSessionsService {
  private readonly sessionConnectRepository: ConnectRepository<FormAgentSession>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>

  constructor(
    @InjectRepository(FormAgentSession)
    formAgentSessionRepository: Repository<FormAgentSession>,

    @InjectRepository(AgentMessage)
    agentMessageRepository: Repository<AgentMessage>,

    @InjectRepository(AgentSettings)
    agentSettingsRepository: Repository<AgentSettings>,
  ) {
    this.sessionConnectRepository = new ConnectRepository(
      formAgentSessionRepository,
      "formAgentSession",
    )
    this.agentMessageConnectRepository = new ConnectRepository(
      agentMessageRepository,
      "agentMessage",
    )
    this.agentSettingsConnectRepository = new ConnectRepository(
      agentSettingsRepository,
      "agentSettings",
    )
  }

  async listSessions({
    connectScope,
    agentId,
    userId,
    type,
  }: {
    userId: string
    connectScope: RequiredConnectScope
    agentId: string
    type: BaseAgentSessionType
  }): Promise<FormAgentSession[]> {
    return this.sessionConnectRepository.find(connectScope, {
      // Exclude sub-sessions (those with a parent session): these are internal
      // artifacts created when a parent agent delegates to this form agent, not
      // user-facing sessions.
      where: { agentId, type, userId, parentSessionId: IsNull() },
      order: { createdAt: "DESC" },
    })
  }

  async createSession({
    connectScope,
    agentSettingsId,
    userId,
    type,
  }: {
    connectScope: RequiredConnectScope
    userId: string
    agentSettingsId: string
    type: BaseAgentSessionType
  }): Promise<FormAgentSession> {
    const agentSettings = await this.agentSettingsConnectRepository.getOneById(
      connectScope,
      agentSettingsId,
    )
    if (!agentSettings)
      throw new NotFoundException(`AgentSettings with id ${agentSettingsId} not found`)

    const session = await this.sessionConnectRepository.createAndSave(connectScope, {
      agentId: agentSettings.agentId,
      userId,
      type,
      traceId: v4(),
    })

    const greetingMessage = agentSettings.greetingMessage
    if (greetingMessage && greetingMessage.trim().length > 0) {
      const now = new Date()
      await this.agentMessageConnectRepository.createAndSave(connectScope, {
        sessionId: session.id,
        agentSettingsId,
        role: "assistant",
        content: greetingMessage,
        status: "completed",
        startedAt: now,
        completedAt: now,
      })
    }

    return session
  }

  async findSessionById({
    connectScope,
    sessionId,
    agentId,
    type,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
    type: BaseAgentSessionType
  }): Promise<FormAgentSession | null> {
    const sessions = await this.sessionConnectRepository.find(connectScope, {
      where: { id: sessionId, agentId, type },
      take: 1,
    })
    const session = sessions[0]
    if (!session) return null
    return session
  }

  /**
   * Finds the form sub-session spawned by a parent agent session for a given
   * form sub-agent, or creates it if it does not exist yet. A single sub-session
   * is reused across parent turns so the form state accumulates.
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
  }): Promise<FormAgentSession> {
    const existing = await this.sessionConnectRepository.find(connectScope, {
      where: { agentId, parentSessionId, type },
      take: 1,
    })
    if (existing[0]) return existing[0]

    return this.sessionConnectRepository.createAndSave(connectScope, {
      agentId,
      userId,
      type,
      parentSessionId,
      result: null,
      traceId: v4(),
    })
  }

  /**
   * Lists the form sub-sessions spawned by a given parent agent session. These
   * are the persistent form sessions created when a parent agent delegates to a
   * form sub-agent (see {@link findOrCreateSubSession}). Scoped to the requesting
   * user to match {@link listSessions} visibility.
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
  }): Promise<FormAgentSession[]> {
    return this.sessionConnectRepository.find(connectScope, {
      where: { parentSessionId, userId, type },
      order: { createdAt: "ASC" },
    })
  }

  async updateSessionResult({
    connectScope,
    input,
    sessionId,
  }: {
    connectScope: RequiredConnectScope
    input: Record<string, unknown>
    sessionId: string
  }): Promise<{ result: Record<string, unknown> | null }> {
    const session = await this.sessionConnectRepository.getOneById(connectScope, sessionId)
    if (!session) return { result: null }

    session.result = { ...session.result, ...input } // mergedResult

    const updatedSession = await this.sessionConnectRepository.saveOne(session)

    return { result: updatedSession.result }
  }
}

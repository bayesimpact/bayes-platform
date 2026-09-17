import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { type EntityManager, In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { ConversationForm } from "./conversation-form.entity"

/**
 * The forms of a conversation: one per agent that collected answers in it.
 * Written by the fillForm tool, read by the Studio, the public API, the
 * review campaigns and the prompts of the agents of the conversation.
 */
@Injectable()
export class ConversationFormsService {
  private readonly conversationFormConnectRepository: ConnectRepository<ConversationForm>

  constructor(
    @InjectRepository(ConversationForm)
    conversationFormRepository: Repository<ConversationForm>,
  ) {
    this.conversationFormConnectRepository = new ConnectRepository(
      conversationFormRepository,
      "conversationForm",
    )
  }

  /** The forms of one session, oldest first. */
  async listForSession({
    connectScope,
    sessionId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
  }): Promise<ConversationForm[]> {
    return this.conversationFormConnectRepository.find(connectScope, {
      where: { sessionId },
      order: { createdAt: "ASC" },
    })
  }

  /** The forms of several sessions, grouped by session (sessions without forms are absent). */
  async listForSessions({
    connectScope,
    sessionIds,
  }: {
    connectScope: RequiredConnectScope
    sessionIds: string[]
  }): Promise<Map<string, ConversationForm[]>> {
    const formsBySessionId = new Map<string, ConversationForm[]>()
    if (sessionIds.length === 0) return formsBySessionId
    const forms = await this.conversationFormConnectRepository.find(connectScope, {
      where: { sessionId: In(sessionIds) },
      order: { createdAt: "ASC" },
    })
    for (const form of forms) {
      const sessionForms = formsBySessionId.get(form.sessionId) ?? []
      sessionForms.push(form)
      formsBySessionId.set(form.sessionId, sessionForms)
    }
    return formsBySessionId
  }

  /** The form one agent fills in one session, if it has written anything yet. */
  async findOne({
    connectScope,
    sessionId,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
  }): Promise<ConversationForm | null> {
    const [form] = await this.conversationFormConnectRepository.find(connectScope, {
      where: { sessionId, agentId },
      take: 1,
    })
    return form ?? null
  }

  /**
   * Merges the given fields into the form of the agent in the session,
   * creating the form on the first write. Only the given keys change: a
   * field collected earlier stays until the same key is written again.
   * Records the settings revision that did the write.
   */
  async mergeFields({
    connectScope,
    sessionId,
    agentId,
    agentSettingsId,
    fields,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
    agentSettingsId: string
    fields: Record<string, unknown>
  }): Promise<ConversationForm> {
    const existing = await this.findOne({ connectScope, sessionId, agentId })
    if (existing) {
      existing.state = { ...existing.state, ...fields }
      existing.agentSettingsId = agentSettingsId
      return this.conversationFormConnectRepository.saveOne(existing)
    }
    return this.conversationFormConnectRepository.createAndSave(connectScope, {
      sessionId,
      agentId,
      agentSettingsId,
      status: "in_progress",
      state: { ...fields },
    })
  }

  /**
   * Marks the form of the agent in the session as concluded, when it exists:
   * the handoff ended and the agent has nothing more to collect.
   */
  async conclude({
    connectScope,
    sessionId,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
  }): Promise<void> {
    await this.conversationFormConnectRepository.updateManyBy({
      connectScope,
      where: { sessionId, agentId },
      fields: { status: "concluded" },
    })
  }

  /**
   * Removes every form of a session. Used by the content purge (the answers
   * are user content, the row has no analytics value) and by session deletion.
   * Runs in the caller's transaction.
   */
  async deleteForSession(entityManager: EntityManager, sessionId: string): Promise<void> {
    await entityManager.delete(ConversationForm, { sessionId })
  }
}

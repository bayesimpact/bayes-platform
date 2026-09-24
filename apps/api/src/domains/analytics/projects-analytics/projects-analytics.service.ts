import type { TimeType } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { getUtcDayKeys } from "@/domains/analytics/shared/analytics-conversation-metrics.helpers"
import type { AnalyticsDailyPoint } from "@/domains/analytics/shared/analytics-metrics.types"
import {
  getAllSessionsDailyTotals,
  getAvgUserQuestionsPerSession,
} from "@/domains/analytics/shared/session-daily-totals.helper"
import { PublicAgentSession } from "@/domains/public-chat/public-agent-sessions/public-agent-session.entity"

@Injectable()
export class ProjectsAnalyticsService {
  private readonly conversationAgentSessionConnectRepository: ConnectRepository<ConversationAgentSession>
  private readonly publicAgentSessionConnectRepository: ConnectRepository<PublicAgentSession>
  private readonly conversationAgentSessionAlias = "conversationAgentSession"
  private readonly publicAgentSessionAlias = "publicAgentSession"

  constructor(
    @InjectRepository(ConversationAgentSession)
    conversationAgentSessionRepository: Repository<ConversationAgentSession>,
    @InjectRepository(PublicAgentSession)
    publicAgentSessionRepository: Repository<PublicAgentSession>,
  ) {
    this.conversationAgentSessionConnectRepository = new ConnectRepository(
      conversationAgentSessionRepository,
      this.conversationAgentSessionAlias,
    )
    this.publicAgentSessionConnectRepository = new ConnectRepository(
      publicAgentSessionRepository,
      this.publicAgentSessionAlias,
    )
  }

  async getConversationsPerDay({
    connectScope,
    agentId,
    startAt,
    endAt,
  }: {
    connectScope: RequiredConnectScope
    agentId?: string
    startAt: TimeType
    endAt: TimeType
  }): Promise<AnalyticsDailyPoint[]> {
    const dayKeys = getUtcDayKeys(startAt, endAt)
    const totalsByDay = await this.getAllSessionsDailyTotals({
      connectScope,
      agentId,
      startAt,
      endAt,
    })

    return dayKeys.map((day) => ({
      date: day,
      value: totalsByDay.get(day)?.sessions ?? 0,
    }))
  }

  async getAvgUserQuestionsPerSessionPerDay({
    connectScope,
    agentId,
    startAt,
    endAt,
  }: {
    connectScope: RequiredConnectScope
    agentId?: string
    startAt: TimeType
    endAt: TimeType
  }): Promise<AnalyticsDailyPoint[]> {
    const dayKeys = getUtcDayKeys(startAt, endAt)
    const totalsByDay = await this.getAllSessionsDailyTotals({
      connectScope,
      agentId,
      startAt,
      endAt,
    })

    return dayKeys.map((day) => ({
      date: day,
      value: getAvgUserQuestionsPerSession(totalsByDay.get(day)),
    }))
  }

  private getAllSessionsDailyTotals(params: {
    connectScope: RequiredConnectScope
    agentId?: string
    startAt: TimeType
    endAt: TimeType
  }) {
    return getAllSessionsDailyTotals({
      conversationAgentSessionConnectRepository: this.conversationAgentSessionConnectRepository,
      conversationAgentSessionAlias: this.conversationAgentSessionAlias,
      publicAgentSessionConnectRepository: this.publicAgentSessionConnectRepository,
      publicAgentSessionAlias: this.publicAgentSessionAlias,
      messageEntity: AgentMessage,
      ...params,
    })
  }
}

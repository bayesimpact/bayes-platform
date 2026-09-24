import type { TimeType } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session-category.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import {
  getDayKeySql,
  getQualifiedColumnSql,
  getUtcDayKeys,
} from "@/domains/analytics/shared/analytics-conversation-metrics.helpers"
import type {
  AnalyticsCategoryDailyPoint,
  AnalyticsDailyPoint,
} from "@/domains/analytics/shared/analytics-metrics.types"
import { getPublicSessionCategoryRows } from "@/domains/analytics/shared/public-session-category-rows.helper"
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
  private readonly sessionCategoryAlias = "sessionCategory"
  private readonly categoryAlias = "category"
  private readonly agentAlias = "agent"

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

  async getConversationsByCategoryPerAgentPerDay({
    connectScope,
    agentId,
    startAt,
    endAt,
  }: {
    connectScope: RequiredConnectScope
    agentId?: string
    startAt: TimeType
    endAt: TimeType
  }): Promise<AnalyticsCategoryDailyPoint[]> {
    const dayExpr = getDayKeySql(this.conversationAgentSessionAlias, "created_at")
    const createdAtCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "created_at")
    const sessionIdCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "id")
    const sessionAgentIdCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "agent_id")
    const agentNameCol = getQualifiedColumnSql(this.agentAlias, "name")

    const sessionCategoryTable = this.conversationAgentSessionConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .subQuery()
      .select(
        getQualifiedColumnSql(this.sessionCategoryAlias, "conversation_agent_session_id"),
        "session_id",
      )
      .addSelect(getQualifiedColumnSql(this.categoryAlias, "id"), "category_id")
      .addSelect(getQualifiedColumnSql(this.categoryAlias, "name"), "category_name")
      .from(ConversationAgentSessionCategory, this.sessionCategoryAlias)
      .innerJoin(
        AgentSessionCategory,
        this.categoryAlias,
        `${getQualifiedColumnSql(this.categoryAlias, "id")} = ${getQualifiedColumnSql(this.sessionCategoryAlias, "agent_session_category_id")} AND ${getQualifiedColumnSql(this.categoryAlias, "deleted_at")} IS NULL`,
      )
      .getQuery()

    const categorizedQueryBuilder = this.conversationAgentSessionConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .innerJoin(
        Agent,
        this.agentAlias,
        `${getQualifiedColumnSql(this.agentAlias, "id")} = ${sessionAgentIdCol}`,
      )
      .innerJoin(
        `(${sessionCategoryTable})`,
        "active_categories",
        `active_categories.session_id = ${sessionIdCol}`,
      )
      .select(dayExpr, "date")
      .addSelect(sessionAgentIdCol, "agentId")
      .addSelect(agentNameCol, "agentName")
      .addSelect("active_categories.category_id", "categoryId")
      .addSelect("active_categories.category_name", "categoryName")
      .addSelect("COUNT(*)::int", "value")
      .andWhere(`${createdAtCol} BETWEEN :startAt AND :endAt`, {
        startAt: new Date(startAt),
        endAt: new Date(endAt),
      })
      .groupBy(dayExpr)
      .addGroupBy(sessionAgentIdCol)
      .addGroupBy(agentNameCol)
      .addGroupBy("active_categories.category_id")
      .addGroupBy("active_categories.category_name")
      .orderBy("date", "ASC")
      .addOrderBy(agentNameCol, "ASC")
      .addOrderBy("active_categories.category_name", "ASC")
    if (agentId) {
      categorizedQueryBuilder.andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
    }
    const categorizedRows = await categorizedQueryBuilder.getRawMany<{
      date: string
      agentId: string
      agentName: string
      categoryId: string
      categoryName: string
      value: string
    }>()

    const uncategorizedQueryBuilder = this.conversationAgentSessionConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .innerJoin(
        Agent,
        this.agentAlias,
        `${getQualifiedColumnSql(this.agentAlias, "id")} = ${sessionAgentIdCol}`,
      )
      .select(dayExpr, "date")
      .addSelect(sessionAgentIdCol, "agentId")
      .addSelect(agentNameCol, "agentName")
      .addSelect("COUNT(*)::int", "value")
      .andWhere(`${createdAtCol} BETWEEN :startAt AND :endAt`, {
        startAt: new Date(startAt),
        endAt: new Date(endAt),
      })
      .andWhere(
        `NOT EXISTS (${this.conversationAgentSessionConnectRepository
          .newQueryBuilderWithConnectScope(connectScope)
          .subQuery()
          .select("1")
          .from(ConversationAgentSessionCategory, this.sessionCategoryAlias)
          .innerJoin(
            AgentSessionCategory,
            this.categoryAlias,
            `${getQualifiedColumnSql(this.categoryAlias, "id")} = ${getQualifiedColumnSql(this.sessionCategoryAlias, "agent_session_category_id")} AND ${getQualifiedColumnSql(this.categoryAlias, "deleted_at")} IS NULL`,
          )
          .where(
            `${getQualifiedColumnSql(this.sessionCategoryAlias, "conversation_agent_session_id")} = ${sessionIdCol}`,
          )
          .getQuery()})`,
      )
      .groupBy(dayExpr)
      .addGroupBy(sessionAgentIdCol)
      .addGroupBy(agentNameCol)
      .orderBy("date", "ASC")
      .addOrderBy(agentNameCol, "ASC")
    if (agentId) {
      uncategorizedQueryBuilder.andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
    }
    const uncategorizedRows = await uncategorizedQueryBuilder.getRawMany<{
      date: string
      agentId: string
      agentName: string
      value: string
    }>()

    // PUBLIC (embed) sessions enter the same aggregation — their categories
    // come from the post-turn classification (#616). Values are summed with
    // the conversation-session rows per (date, agent, category).
    const publicRows = await getPublicSessionCategoryRows({
      publicAgentSessionConnectRepository: this.publicAgentSessionConnectRepository,
      connectScope,
      agentId,
      startAt,
      endAt,
    })

    const categorizedByKey = new Map<string, AnalyticsCategoryDailyPoint>()
    for (const row of [...categorizedRows, ...publicRows.categorizedRows]) {
      const key = `${row.date}|${row.agentId}|${row.categoryId}`
      const existing = categorizedByKey.get(key)
      if (existing) {
        existing.value += Number(row.value)
      } else {
        categorizedByKey.set(key, {
          date: row.date,
          agentId: row.agentId,
          agentName: row.agentName,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          value: Number(row.value),
          isUncategorized: false,
        })
      }
    }
    const categorizedPoints = [...categorizedByKey.values()]

    const uncategorizedByKey = new Map<string, AnalyticsCategoryDailyPoint>()
    for (const row of [...uncategorizedRows, ...publicRows.uncategorizedRows]) {
      if (Number(row.value) <= 0) continue
      const key = `${row.date}|${row.agentId}`
      const existing = uncategorizedByKey.get(key)
      if (existing) {
        existing.value += Number(row.value)
      } else {
        uncategorizedByKey.set(key, {
          date: row.date,
          agentId: row.agentId,
          agentName: row.agentName,
          categoryName: "uncategorized",
          value: Number(row.value),
          isUncategorized: true,
        })
      }
    }
    const uncategorizedPoints = [...uncategorizedByKey.values()]

    return [...categorizedPoints, ...uncategorizedPoints].sort(
      (firstPoint, secondPoint) =>
        firstPoint.date.localeCompare(secondPoint.date) ||
        firstPoint.agentName.localeCompare(secondPoint.agentName) ||
        firstPoint.categoryName.localeCompare(secondPoint.categoryName),
    )
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

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

@Injectable()
export class AgentsAnalyticsService {
  private readonly conversationAgentSessionConnectRepository: ConnectRepository<ConversationAgentSession>
  private readonly conversationAgentSessionAlias = "conversationAgentSession"
  private readonly agentMessageAlias = "agentMessage"
  private readonly sessionCategoryAlias = "sessionCategory"
  private readonly categoryAlias = "category"
  private readonly agentAlias = "agent"

  constructor(
    @InjectRepository(ConversationAgentSession)
    conversationAgentSessionRepository: Repository<ConversationAgentSession>,
  ) {
    this.conversationAgentSessionConnectRepository = new ConnectRepository(
      conversationAgentSessionRepository,
      this.conversationAgentSessionAlias,
    )
  }

  async getConversationsPerDay({
    connectScope,
    agentId,
    startAt,
    endAt,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    startAt: TimeType
    endAt: TimeType
  }): Promise<AnalyticsDailyPoint[]> {
    const dayKeys = getUtcDayKeys(startAt, endAt)
    const dayExpr = getDayKeySql(this.conversationAgentSessionAlias, "created_at")
    const createdAtCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "created_at")
    const agentIdCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "agent_id")

    const raw = await this.conversationAgentSessionConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .andWhere(`${agentIdCol} = :agentId`, { agentId })
      .select(dayExpr, "date")
      .addSelect("COUNT(*)::int", "value")
      .andWhere(`${createdAtCol} BETWEEN :startAt AND :endAt`, {
        startAt: new Date(startAt),
        endAt: new Date(endAt),
      })
      .groupBy(dayExpr)
      .orderBy("date", "ASC")
      .getRawMany<{
        date: string
        value: string
      }>()

    const valueByDay = new Map(raw.map((row) => [row.date, Number(row.value)]))

    return dayKeys.map((day) => ({
      date: day,
      value: valueByDay.get(day) ?? 0,
    }))
  }

  async getAvgUserQuestionsPerSessionPerDay({
    connectScope,
    agentId,
    startAt,
    endAt,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    startAt: TimeType
    endAt: TimeType
  }): Promise<AnalyticsDailyPoint[]> {
    const dayKeys = getUtcDayKeys(startAt, endAt)

    const dayExpr = getDayKeySql(this.conversationAgentSessionAlias, "created_at")
    const createdAtCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "created_at")
    const conversationIdCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "id")
    const agentMessageIdCol = getQualifiedColumnSql(this.agentMessageAlias, "id")
    const agentIdCol = getQualifiedColumnSql(this.conversationAgentSessionAlias, "agent_id")

    const raw = await this.conversationAgentSessionConnectRepository
      .newQueryBuilderWithConnectScope(connectScope)
      .andWhere(`${agentIdCol} = :agentId`, { agentId })
      .leftJoin(
        AgentMessage,
        this.agentMessageAlias,
        `${getQualifiedColumnSql(this.agentMessageAlias, "session_id")} = ${getQualifiedColumnSql(this.conversationAgentSessionAlias, "id")}
          AND ${getQualifiedColumnSql(this.agentMessageAlias, "role")} = :userRole`,
        { userRole: "user" },
      )
      .select(dayExpr, "date")
      .addSelect(
        `COALESCE((COUNT(${agentMessageIdCol})::float / NULLIF(COUNT(DISTINCT ${conversationIdCol}), 0)), 0)`,
        "value",
      )
      .andWhere(`${createdAtCol} BETWEEN :startAt AND :endAt`, {
        startAt: new Date(startAt),
        endAt: new Date(endAt),
      })
      .groupBy(dayExpr)
      .orderBy("date", "ASC")
      .getRawMany<{
        date: string
        value: string
      }>()

    const valueByDay = new Map(raw.map((row) => [row.date, Number(row.value)]))

    return dayKeys.map((day) => ({
      date: day,
      value: valueByDay.get(day) ?? 0,
    }))
  }

  async getConversationsByCategoryPerDay({
    connectScope,
    agentId,
    startAt,
    endAt,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
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

    const categorizedRows = await this.conversationAgentSessionConnectRepository
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
      .andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
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
      .addOrderBy("active_categories.category_name", "ASC")
      .getRawMany<{
        date: string
        agentId: string
        agentName: string
        categoryId: string
        categoryName: string
        value: string
      }>()

    const uncategorizedRows = await this.conversationAgentSessionConnectRepository
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
      .andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
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
      .getRawMany<{
        date: string
        agentId: string
        agentName: string
        value: string
      }>()

    const categorizedPoints: AnalyticsCategoryDailyPoint[] = categorizedRows.map((row) => ({
      date: row.date,
      agentId: row.agentId,
      agentName: row.agentName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      value: Number(row.value),
      isUncategorized: false,
    }))

    const uncategorizedPoints: AnalyticsCategoryDailyPoint[] = uncategorizedRows
      .filter((row) => Number(row.value) > 0)
      .map((row) => ({
        date: row.date,
        agentId: row.agentId,
        agentName: row.agentName,
        categoryName: "uncategorized",
        value: Number(row.value),
        isUncategorized: true,
      }))

    return [...categorizedPoints, ...uncategorizedPoints].sort(
      (firstPoint, secondPoint) =>
        firstPoint.date.localeCompare(secondPoint.date) ||
        firstPoint.categoryName.localeCompare(secondPoint.categoryName),
    )
  }
}

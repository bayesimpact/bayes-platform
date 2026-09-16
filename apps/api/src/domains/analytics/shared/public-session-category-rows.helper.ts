import type { TimeType } from "@caseai-connect/api-contracts"
import type { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import {
  getDayKeySql,
  getQualifiedColumnSql,
} from "@/domains/analytics/shared/analytics-conversation-metrics.helpers"
import type { PublicAgentSession } from "@/domains/public-chat/public-agent-sessions/public-agent-session.entity"
import { PublicAgentSessionCategory } from "@/domains/public-chat/public-agent-sessions/public-agent-session-category.entity"

export type CategoryDailyRow = {
  date: string
  agentId: string
  agentName: string
  categoryId: string
  categoryName: string
  value: string
}

export type UncategorizedDailyRow = {
  date: string
  agentId: string
  agentName: string
  value: string
}

const PUBLIC_SESSION_ALIAS = "publicAgentSession"
const PUBLIC_SESSION_CATEGORY_ALIAS = "publicSessionCategory"
const CATEGORY_ALIAS = "publicCategory"
const AGENT_ALIAS = "publicSessionAgent"

/**
 * PUBLIC (embed) sessions' contribution to the conversations-by-category
 * analytics — same row shapes as the conversation-session queries, so both
 * sources merge by summing values per (date, agent, category). Embed
 * sessions get their categories from the post-turn classification (#616).
 */
export async function getPublicSessionCategoryRows({
  publicAgentSessionConnectRepository,
  connectScope,
  agentId,
  startAt,
  endAt,
}: {
  publicAgentSessionConnectRepository: ConnectRepository<PublicAgentSession>
  connectScope: RequiredConnectScope
  agentId?: string
  startAt: TimeType
  endAt: TimeType
}): Promise<{ categorizedRows: CategoryDailyRow[]; uncategorizedRows: UncategorizedDailyRow[] }> {
  const dayExpr = getDayKeySql(PUBLIC_SESSION_ALIAS, "created_at")
  const createdAtCol = getQualifiedColumnSql(PUBLIC_SESSION_ALIAS, "created_at")
  const sessionIdCol = getQualifiedColumnSql(PUBLIC_SESSION_ALIAS, "id")
  const sessionAgentIdCol = getQualifiedColumnSql(PUBLIC_SESSION_ALIAS, "agent_id")
  const agentNameCol = getQualifiedColumnSql(AGENT_ALIAS, "name")

  const sessionCategoryTable = publicAgentSessionConnectRepository
    .newQueryBuilderWithConnectScope(connectScope)
    .subQuery()
    .select(
      getQualifiedColumnSql(PUBLIC_SESSION_CATEGORY_ALIAS, "public_agent_session_id"),
      "session_id",
    )
    .addSelect(getQualifiedColumnSql(CATEGORY_ALIAS, "id"), "category_id")
    .addSelect(getQualifiedColumnSql(CATEGORY_ALIAS, "name"), "category_name")
    .from(PublicAgentSessionCategory, PUBLIC_SESSION_CATEGORY_ALIAS)
    .innerJoin(
      AgentSessionCategory,
      CATEGORY_ALIAS,
      `${getQualifiedColumnSql(CATEGORY_ALIAS, "id")} = ${getQualifiedColumnSql(PUBLIC_SESSION_CATEGORY_ALIAS, "agent_session_category_id")} AND ${getQualifiedColumnSql(CATEGORY_ALIAS, "deleted_at")} IS NULL`,
    )
    .getQuery()

  const categorizedQueryBuilder = publicAgentSessionConnectRepository
    .newQueryBuilderWithConnectScope(connectScope)
    .innerJoin(
      Agent,
      AGENT_ALIAS,
      `${getQualifiedColumnSql(AGENT_ALIAS, "id")} = ${sessionAgentIdCol}`,
    )
    .innerJoin(
      `(${sessionCategoryTable})`,
      "public_active_categories",
      `public_active_categories.session_id = ${sessionIdCol}`,
    )
    .select(dayExpr, "date")
    .addSelect(sessionAgentIdCol, "agentId")
    .addSelect(agentNameCol, "agentName")
    .addSelect("public_active_categories.category_id", "categoryId")
    .addSelect("public_active_categories.category_name", "categoryName")
    .addSelect("COUNT(*)::int", "value")
    .andWhere(`${createdAtCol} BETWEEN :startAt AND :endAt`, {
      startAt: new Date(startAt),
      endAt: new Date(endAt),
    })
    .groupBy(dayExpr)
    .addGroupBy(sessionAgentIdCol)
    .addGroupBy(agentNameCol)
    .addGroupBy("public_active_categories.category_id")
    .addGroupBy("public_active_categories.category_name")
  if (agentId) {
    categorizedQueryBuilder.andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
  }
  const categorizedRows = await categorizedQueryBuilder.getRawMany<CategoryDailyRow>()

  const uncategorizedQueryBuilder = publicAgentSessionConnectRepository
    .newQueryBuilderWithConnectScope(connectScope)
    .innerJoin(
      Agent,
      AGENT_ALIAS,
      `${getQualifiedColumnSql(AGENT_ALIAS, "id")} = ${sessionAgentIdCol}`,
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
      `NOT EXISTS (${publicAgentSessionConnectRepository
        .newQueryBuilderWithConnectScope(connectScope)
        .subQuery()
        .select("1")
        .from(PublicAgentSessionCategory, PUBLIC_SESSION_CATEGORY_ALIAS)
        .where(
          `${getQualifiedColumnSql(PUBLIC_SESSION_CATEGORY_ALIAS, "public_agent_session_id")} = ${sessionIdCol}`,
        )
        .getQuery()})`,
    )
    .groupBy(dayExpr)
    .addGroupBy(sessionAgentIdCol)
    .addGroupBy(agentNameCol)
  if (agentId) {
    uncategorizedQueryBuilder.andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
  }
  const uncategorizedRows = await uncategorizedQueryBuilder.getRawMany<UncategorizedDailyRow>()

  return { categorizedRows, uncategorizedRows }
}

import type { TimeType } from "@caseai-connect/api-contracts"
import type { ConnectEntityBase } from "@/common/entities/connect-entity"
import type { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  getDayKeySql,
  getQualifiedColumnSql,
} from "@/domains/analytics/shared/analytics-conversation-metrics.helpers"

export type SessionDailyTotals = {
  sessions: number
  userMessages: number
}

type DailyTotalsParams = {
  /** The agent message entity: its `session_id` references both session tables. */
  messageEntity: new () => ConnectEntityBase
  connectScope: RequiredConnectScope
  agentId?: string
  startAt: TimeType
  endAt: TimeType
}

/** Sessions started and user messages sent in them, per UTC day of the session start. */
async function getSessionDailyTotals<Session extends ConnectEntityBase>({
  sessionConnectRepository,
  sessionAlias,
  messageEntity,
  connectScope,
  agentId,
  startAt,
  endAt,
}: DailyTotalsParams & {
  sessionConnectRepository: ConnectRepository<Session>
  sessionAlias: string
}): Promise<Map<string, SessionDailyTotals>> {
  const messageAlias = `${sessionAlias}Message`
  const dayExpr = getDayKeySql(sessionAlias, "created_at")
  const createdAtCol = getQualifiedColumnSql(sessionAlias, "created_at")
  const sessionIdCol = getQualifiedColumnSql(sessionAlias, "id")
  const sessionAgentIdCol = getQualifiedColumnSql(sessionAlias, "agent_id")
  const messageIdCol = getQualifiedColumnSql(messageAlias, "id")

  const queryBuilder = sessionConnectRepository
    .newQueryBuilderWithConnectScope(connectScope)
    .leftJoin(
      messageEntity,
      messageAlias,
      `${getQualifiedColumnSql(messageAlias, "session_id")} = ${sessionIdCol}
        AND ${getQualifiedColumnSql(messageAlias, "role")} = :userRole`,
      { userRole: "user" },
    )
    .select(dayExpr, "date")
    .addSelect(`COUNT(DISTINCT ${sessionIdCol})::int`, "sessions")
    .addSelect(`COUNT(${messageIdCol})::int`, "userMessages")
    .andWhere(`${createdAtCol} BETWEEN :startAt AND :endAt`, {
      startAt: new Date(startAt),
      endAt: new Date(endAt),
    })
    .groupBy(dayExpr)
  if (agentId) {
    queryBuilder.andWhere(`${sessionAgentIdCol} = :agentId`, { agentId })
  }

  const rows = await queryBuilder.getRawMany<{
    date: string
    sessions: string
    userMessages: string
  }>()

  return new Map(
    rows.map((row) => [
      row.date,
      { sessions: Number(row.sessions), userMessages: Number(row.userMessages) },
    ]),
  )
}

/**
 * Daily totals over both session sources: conversation sessions (studio and
 * app) and PUBLIC (embed) sessions. `agent_message.session_id` references
 * either table, so the message join is the same for both.
 */
export async function getAllSessionsDailyTotals<
  ConversationSession extends ConnectEntityBase,
  PublicSession extends ConnectEntityBase,
>({
  conversationAgentSessionConnectRepository,
  conversationAgentSessionAlias,
  publicAgentSessionConnectRepository,
  publicAgentSessionAlias,
  ...params
}: DailyTotalsParams & {
  conversationAgentSessionConnectRepository: ConnectRepository<ConversationSession>
  conversationAgentSessionAlias: string
  publicAgentSessionConnectRepository: ConnectRepository<PublicSession>
  publicAgentSessionAlias: string
}): Promise<Map<string, SessionDailyTotals>> {
  const [conversationTotals, publicTotals] = await Promise.all([
    getSessionDailyTotals({
      sessionConnectRepository: conversationAgentSessionConnectRepository,
      sessionAlias: conversationAgentSessionAlias,
      ...params,
    }),
    getSessionDailyTotals({
      sessionConnectRepository: publicAgentSessionConnectRepository,
      sessionAlias: publicAgentSessionAlias,
      ...params,
    }),
  ])
  return mergeSessionDailyTotals(conversationTotals, publicTotals)
}

/** Sums the totals of the same day. */
function mergeSessionDailyTotals(
  first: Map<string, SessionDailyTotals>,
  second: Map<string, SessionDailyTotals>,
): Map<string, SessionDailyTotals> {
  const merged = new Map(first)
  for (const [day, totals] of second) {
    const existing = merged.get(day)
    merged.set(
      day,
      existing
        ? {
            sessions: existing.sessions + totals.sessions,
            userMessages: existing.userMessages + totals.userMessages,
          }
        : totals,
    )
  }
  return merged
}

/** Mean user messages per session, weighted over all sources of the day. */
export function getAvgUserQuestionsPerSession(totals: SessionDailyTotals | undefined): number {
  if (!totals || totals.sessions === 0) {
    return 0
  }
  return totals.userMessages / totals.sessions
}

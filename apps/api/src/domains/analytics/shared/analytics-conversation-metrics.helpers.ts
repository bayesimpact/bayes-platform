import type { TimeType } from "@caseai-connect/api-contracts"
import { BadRequestException } from "@nestjs/common"
import type { ConversationAgentSessionType } from "@/domains/agents/base-agent-sessions/base-agent-sessions.types"

export function getUtcDayKeys(startAt: TimeType, endAt: TimeType): string[] {
  if (endAt < startAt) {
    throw new BadRequestException("Invalid date range")
  }

  const startDate = new Date(startAt)
  const endDate = new Date(endAt)

  const startUtcDay = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
  )
  const endUtcDay = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
  )

  const days: string[] = []
  for (
    let current = startUtcDay;
    current.getTime() <= endUtcDay.getTime();
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
  ) {
    days.push(current.toISOString().slice(0, 10))
  }

  return days
}

export function getQualifiedColumnSql(alias: string, columnName: string): string {
  // Quote the alias to preserve case. Postgres folds unquoted identifiers to lowercase.
  return `"${alias}"."${columnName}"`
}

export function getDayKeySql(alias: string, createdAtColumnName: string): string {
  // Match UTC day bucketing used by previous `toISOString().slice(0, 10)`.
  const createdAtCol = getQualifiedColumnSql(alias, createdAtColumnName)
  return `to_char(timezone('UTC', ${createdAtCol})::date, 'YYYY-MM-DD')`
}

const PLAYGROUND_SESSION_TYPE: ConversationAgentSessionType = "playground"

/**
 * Leaves out playground sessions: they are the builders' tests of an agent, not its use, so no
 * analytics chart counts them. Only conversation sessions have a type.
 */
export function getExcludePlaygroundSql(conversationSessionAlias: string): string {
  return `${getQualifiedColumnSql(conversationSessionAlias, "type")} <> '${PLAYGROUND_SESSION_TYPE}'`
}

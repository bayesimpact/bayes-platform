import type { TimeType } from "@bayes-platform/api-contracts"
import { BadRequestException } from "@nestjs/common"

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

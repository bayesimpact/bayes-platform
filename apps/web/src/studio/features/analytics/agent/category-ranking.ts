import type { AnalyticsCategoryDailyPoint, AnalyticsDailyPoint } from "../project/analytics.models"

export type CategoryRankingRow = {
  key: string
  label: string
  isUncategorized: boolean
  total: number
  /** Share of the conversations of the period, between 0 and 1. */
  share: number
  /** One point per date of the period, zero-filled. */
  dailySeries: AnalyticsDailyPoint[]
}

export type CategoryRanking = {
  categories: CategoryRankingRow[]
  uncategorized: CategoryRankingRow | null
  total: number
}

function getCategoryKey(point: AnalyticsCategoryDailyPoint): string {
  if (point.isUncategorized) {
    return "__uncategorized__"
  }
  return point.categoryId ?? point.categoryName
}

export function buildCategoryRanking({
  points,
  allDates,
  conversationTotal,
  uncategorizedLabel,
}: {
  points: AnalyticsCategoryDailyPoint[]
  allDates: string[]
  /**
   * Conversations of the period. A conversation can have several categories, so
   * shares are taken on it rather than on the sum of category counts.
   */
  conversationTotal?: number
  uncategorizedLabel: string
}): CategoryRanking {
  const rowsByKey = new Map<
    string,
    { label: string; isUncategorized: boolean; valuesByDate: Map<string, number> }
  >()
  for (const point of points) {
    const key = getCategoryKey(point)
    let row = rowsByKey.get(key)
    if (!row) {
      row = {
        label: point.isUncategorized ? uncategorizedLabel : point.categoryName,
        isUncategorized: point.isUncategorized,
        valuesByDate: new Map(),
      }
      rowsByKey.set(key, row)
    }
    row.valuesByDate.set(point.date, (row.valuesByDate.get(point.date) ?? 0) + point.value)
  }

  const categoryCountTotal = points.reduce((sum, point) => sum + point.value, 0)
  const total = conversationTotal && conversationTotal > 0 ? conversationTotal : categoryCountTotal

  const rows: CategoryRankingRow[] = Array.from(rowsByKey.entries()).map(([key, row]) => {
    const rowTotal = Array.from(row.valuesByDate.values()).reduce((sum, value) => sum + value, 0)
    return {
      key,
      label: row.label,
      isUncategorized: row.isUncategorized,
      total: rowTotal,
      share: total === 0 ? 0 : rowTotal / total,
      dailySeries: allDates.map((date) => ({ date, value: row.valuesByDate.get(date) ?? 0 })),
    }
  })

  const categories = rows
    .filter((row) => !row.isUncategorized)
    .sort(
      (firstRow, secondRow) =>
        secondRow.total - firstRow.total || firstRow.label.localeCompare(secondRow.label),
    )

  return {
    categories,
    uncategorized: rows.find((row) => row.isUncategorized) ?? null,
    total,
  }
}

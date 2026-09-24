import { describe, expect, it } from "vitest"
import type { AnalyticsCategoryDailyPoint } from "../project/analytics.models"
import { buildCategoryRanking } from "./category-ranking"

function buildPoint(overrides: Partial<AnalyticsCategoryDailyPoint>): AnalyticsCategoryDailyPoint {
  return {
    date: "2026-05-10",
    agentId: "agent-1",
    agentName: "Helpful Assistant",
    categoryId: "support",
    categoryName: "Support",
    value: 1,
    isUncategorized: false,
    ...overrides,
  }
}

const DATES = ["2026-05-10", "2026-05-11"]

describe("buildCategoryRanking", () => {
  it("sorts categories by volume and keeps uncategorized apart", () => {
    const ranking = buildCategoryRanking({
      points: [
        buildPoint({ categoryId: "pricing", categoryName: "Pricing", value: 2 }),
        buildPoint({ categoryId: "support", categoryName: "Support", value: 5 }),
        buildPoint({ categoryId: undefined, categoryName: "", isUncategorized: true, value: 3 }),
      ],
      allDates: DATES,
      uncategorizedLabel: "Uncategorized",
    })

    expect(ranking.categories.map((row) => row.label)).toEqual(["Support", "Pricing"])
    expect(ranking.uncategorized?.label).toBe("Uncategorized")
    expect(ranking.total).toBe(10)
    expect(ranking.categories[0]?.share).toBe(0.5)
  })

  it("takes shares on the conversation total when given", () => {
    const ranking = buildCategoryRanking({
      points: [
        buildPoint({ categoryId: "support", categoryName: "Support", value: 6 }),
        buildPoint({ categoryId: "pricing", categoryName: "Pricing", value: 4 }),
      ],
      allDates: DATES,
      // Some conversations have both categories.
      conversationTotal: 8,
      uncategorizedLabel: "Uncategorized",
    })

    expect(ranking.categories.map((row) => row.share)).toEqual([0.75, 0.5])
  })

  it("zero-fills the daily series", () => {
    const ranking = buildCategoryRanking({
      points: [buildPoint({ value: 5 })],
      allDates: DATES,
      uncategorizedLabel: "Uncategorized",
    })

    expect(ranking.categories[0]?.dailySeries).toEqual([
      { date: "2026-05-10", value: 5 },
      { date: "2026-05-11", value: 0 },
    ])
  })
})

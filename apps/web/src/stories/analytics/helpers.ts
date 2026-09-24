import { faker } from "@faker-js/faker"
import type { Agent } from "@/common/features/agents/agents.models"
import { analyticsCategoryDailyPointFactory } from "@/studio/features/analytics/project/analytics.factory"
import type {
  AnalyticsCategoryDailyPoint,
  AnalyticsDailyPoint,
} from "@/studio/features/analytics/project/analytics.models"

const STORY_CATEGORIES = [
  { name: "Support", weight: 18 },
  { name: "Pricing", weight: 12 },
  { name: "Product", weight: 9 },
  { name: "Billing", weight: 7 },
  { name: "Account", weight: 6 },
  { name: "Onboarding", weight: 5 },
  { name: "Integrations", weight: 4 },
  { name: "Feedback", weight: 3 },
  { name: "Security", weight: 2 },
  { name: "Other", weight: 1 },
]

export function buildStoryDates(startDate: string, dayCount: number): string[] {
  const start = new Date(`${startDate}T00:00:00Z`)
  return Array.from({ length: dayCount }, (_unused, dayIndex) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + dayIndex)
    return date.toISOString().slice(0, 10)
  })
}

/** Uneven volumes per category over fixed dates, plus an uncategorized share. */
export function buildStoryCategoryPoints({
  agents,
  dates,
  seed = 1,
  scale = 1,
  withUncategorized = true,
}: {
  agents: Agent[]
  dates: string[]
  seed?: number
  scale?: number
  withUncategorized?: boolean
}): AnalyticsCategoryDailyPoint[] {
  faker.seed(seed)
  return agents.flatMap((agent) =>
    dates.flatMap((date) => {
      const categorized = STORY_CATEGORIES.map((category) =>
        analyticsCategoryDailyPointFactory.transient({ agent }).build({
          date,
          categoryId: category.name.toLowerCase(),
          categoryName: category.name,
          value: Math.round(category.weight * scale * faker.number.float({ min: 0.3, max: 1.7 })),
        }),
      )
      if (!withUncategorized) {
        return categorized
      }
      const uncategorized = analyticsCategoryDailyPointFactory.transient({ agent }).build({
        date,
        categoryName: "",
        isUncategorized: true,
        value: Math.round(6 * scale * faker.number.float({ min: 0.5, max: 1.5 })),
      })
      return [...categorized, uncategorized]
    }),
  )
}

/** Conversations per day consistent with the category points (one category per conversation). */
export function buildStoryConversationsPerDay(
  points: AnalyticsCategoryDailyPoint[],
  dates: string[],
): AnalyticsDailyPoint[] {
  return dates.map((date) => ({
    date,
    value: points
      .filter((point) => point.date === date)
      .reduce((sum, point) => sum + point.value, 0),
  }))
}

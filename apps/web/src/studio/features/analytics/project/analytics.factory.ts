import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { AnalyticsCategoryDailyPoint, AnalyticsDailyPoint } from "./analytics.models"

class AnalyticsDailyPointFactory extends Factory<AnalyticsDailyPoint> {}

export const analyticsDailyPointFactory = AnalyticsDailyPointFactory.define(({ params }) => ({
  date: params.date ?? faker.date.recent().toISOString().slice(0, 10),
  value: params.value ?? faker.number.int({ min: 0, max: 100 }),
}))

type AnalyticsCategoryDailyPointTransientParams = {
  agent: Agent
}

class AnalyticsCategoryDailyPointFactory extends Factory<
  AnalyticsCategoryDailyPoint,
  AnalyticsCategoryDailyPointTransientParams
> {}

export const analyticsCategoryDailyPointFactory = AnalyticsCategoryDailyPointFactory.define(
  ({ params, transientParams }) => {
    const { agent } = transientParams
    if (!agent) {
      throw new Error(
        "Agent must be provided in transient params to build an AnalyticsCategoryDailyPoint",
      )
    }
    const isUncategorized = params.isUncategorized ?? false
    return {
      date: params.date ?? faker.date.recent().toISOString().slice(0, 10),
      agentId: params.agentId ?? agent.id,
      agentName: params.agentName ?? agent.name,
      ...(params.categoryId !== undefined ? { categoryId: params.categoryId } : {}),
      categoryName: params.categoryName ?? faker.commerce.department(),
      value: params.value ?? faker.number.int({ min: 0, max: 50 }),
      isUncategorized,
    }
  },
)

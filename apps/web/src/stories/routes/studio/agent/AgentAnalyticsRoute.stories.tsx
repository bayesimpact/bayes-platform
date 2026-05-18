import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import type { IAgentAnalyticsSpi } from "@/studio/features/analytics/agent/agent-analytics.spi"
import {
  analyticsCategoryDailyPointFactory,
  analyticsDailyPointFactory,
} from "@/studio/features/analytics/project/analytics.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withAnalytics?: boolean
  withCategories?: boolean
}

const DATES = ["2026-05-09", "2026-05-10", "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14"]

function buildAnalytics(agent: Agent) {
  const conversationsPerDay = DATES.map((date) => analyticsDailyPointFactory.build({ date }))
  const avgUserQuestionsPerSessionPerDay = DATES.map((date) =>
    analyticsDailyPointFactory.build({ date }),
  )
  const conversationsByCategoryPerDay = DATES.flatMap((date) =>
    analyticsCategoryDailyPointFactory.transient({ agent }).buildList(2, { date }),
  )
  return { conversationsPerDay, avgUserQuestionsPerSessionPerDay, conversationsByCategoryPerDay }
}

function buildMockAgentAnalyticsService(
  overrides: Partial<{
    conversationsPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    avgUserQuestionsPerSessionPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    conversationsByCategoryPerDay: ReturnType<typeof analyticsCategoryDailyPointFactory.build>[]
  }> = {},
): IAgentAnalyticsSpi {
  return {
    async getConversationsPerDay() {
      return overrides.conversationsPerDay ?? []
    },
    async getAvgUserQuestionsPerSessionPerDay() {
      return overrides.avgUserQuestionsPerSessionPerDay ?? []
    },
    async getConversationsByCategoryPerDay() {
      return overrides.conversationsByCategoryPerDay ?? []
    },
  }
}

const meta = {
  title: "routes/studio/project/agent/analytics",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withAnalytics: { control: "boolean" },
    withCategories: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    featureFlags: [...studioStoryArgs.featureFlags, "project-analytics"],
    withAnalytics: false,
    withCategories: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.agentAnalytics.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withAnalytics, withCategories, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: "conversation", hasCategories: withCategories })

      const analytics = withAnalytics
        ? buildAnalytics(currentAgent)
        : {
            conversationsPerDay: [],
            avgUserQuestionsPerSessionPerDay: [],
            conversationsByCategoryPerDay: [],
          }

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [] }),
          seed.studio.agentAnalytics(analytics),
        ),
        services: {
          agentAnalytics: buildMockAgentAnalyticsService(analytics),
        },
      }
    }),
  ],
}

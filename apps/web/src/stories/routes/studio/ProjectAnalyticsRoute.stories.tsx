import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { analyticsDailyPointFactory } from "@/studio/features/analytics/project/analytics.factory"
import type { IProjectAnalyticsSpi } from "@/studio/features/analytics/project/analytics.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withAnalytics?: boolean
}

const DATES = ["2026-05-09", "2026-05-10", "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14"]

function buildAnalytics() {
  const conversationsPerDay = DATES.map((date) => analyticsDailyPointFactory.build({ date }))
  const avgUserQuestionsPerSessionPerDay = DATES.map((date) =>
    analyticsDailyPointFactory.build({ date }),
  )
  return { conversationsPerDay, avgUserQuestionsPerSessionPerDay }
}

function buildMockProjectAnalyticsService(
  overrides: Partial<{
    conversationsPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    avgUserQuestionsPerSessionPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
  }> = {},
): IProjectAnalyticsSpi {
  return {
    async getConversationsPerDay() {
      return overrides.conversationsPerDay ?? []
    },
    async getAvgUserQuestionsPerSessionPerDay() {
      return overrides.avgUserQuestionsPerSessionPerDay ?? []
    },
  }
}

const meta = {
  title: "routes/studio/project/analytics",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAnalytics: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "project-analytics"],
    withAnalytics: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.projectAnalytics.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withAnalytics, ...args }) => {
      const { baseSeeds } = buildStudioData(args)
      const analytics = withAnalytics
        ? buildAnalytics()
        : {
            conversationsPerDay: [],
            avgUserQuestionsPerSessionPerDay: [],
          }
      return {
        state: mergeSeeds(baseSeeds, seed.studio.projectAnalytics(analytics)),
        services: {
          projectAnalytics: buildMockProjectAnalyticsService(analytics),
        },
      }
    }),
  ],
}

export const WithData: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: ["project-analytics"],
    withAgents: true,
    withAnalytics: true,
  },

  decorators: [
    buildDecorator<StoryArgs>(({ withAnalytics, ...args }) => {
      const { baseSeeds } = buildStudioData(args)
      const analytics = withAnalytics
        ? buildAnalytics()
        : {
            conversationsPerDay: [],
            avgUserQuestionsPerSessionPerDay: [],
          }
      return {
        state: mergeSeeds(baseSeeds, seed.studio.projectAnalytics(analytics)),

        services: {
          projectAnalytics: buildMockProjectAnalyticsService(analytics),
        },
      }
    }),
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  buildStoryCategoryPoints,
  buildStoryConversationsPerDay,
} from "@/stories/analytics/helpers"
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
  type analyticsCategoryDailyPointFactory,
  analyticsDailyPointFactory,
} from "@/studio/features/analytics/project/analytics.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withAnalytics?: boolean
  withCategories?: boolean
  withMostlyEmptySessions?: boolean
}

const DATES = ["2026-05-09", "2026-05-10", "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14"]

/** A few empty sessions, or an integration that opens a session on every page load. */
function buildEmptySessionsPerDay(
  conversationsPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[],
  withMostlyEmptySessions: boolean,
) {
  return conversationsPerDay.map((point, dayIndex) =>
    analyticsDailyPointFactory.build({
      date: point.date,
      value: withMostlyEmptySessions ? point.value * 40 : dayIndex % 2,
    }),
  )
}

function buildAnalytics(agent: Agent, withMostlyEmptySessions: boolean) {
  const conversationsByCategoryPerDay = buildStoryCategoryPoints({ agents: [agent], dates: DATES })
  const conversationsPerDay = buildStoryConversationsPerDay(conversationsByCategoryPerDay, DATES)
  const avgUserQuestionsPerSessionPerDay = DATES.map((date) =>
    analyticsDailyPointFactory.build({ date }),
  )
  const emptySessionsPerDay = buildEmptySessionsPerDay(conversationsPerDay, withMostlyEmptySessions)
  return {
    conversationsPerDay,
    avgUserQuestionsPerSessionPerDay,
    conversationsByCategoryPerDay,
    emptySessionsPerDay,
  }
}

function buildMockAgentAnalyticsService(
  overrides: Partial<{
    conversationsPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    avgUserQuestionsPerSessionPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    conversationsByCategoryPerDay: ReturnType<typeof analyticsCategoryDailyPointFactory.build>[]
    emptySessionsPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
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
    async getEmptySessionsPerDay() {
      return overrides.emptySessionsPerDay ?? []
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
    withMostlyEmptySessions: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    featureFlags: [...studioStoryArgs.featureFlags, "project-analytics"],
    withAnalytics: false,
    withCategories: false,
    withMostlyEmptySessions: false,
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
    buildDecorator<StoryArgs>(
      ({ withAnalytics, withCategories, withMostlyEmptySessions, ...args }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents
        const currentAgent = agentFactory
          .transient({ project })
          .build({ ...firstAgent, type: "conversation" })
        const currentAgentSettings = agentSettingsFactory.transient({ agent: currentAgent }).build({
          revision: currentAgent.currentRevision?.number ?? 1,
          hasCategories: withCategories,
        })

        const analytics = withAnalytics
          ? buildAnalytics(currentAgent, withMostlyEmptySessions ?? false)
          : {
              conversationsPerDay: [],
              avgUserQuestionsPerSessionPerDay: [],
              conversationsByCategoryPerDay: [],
              emptySessionsPerDay: [],
            }

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
            seed.conversationAgentSessions({ [currentAgent.id]: [] }),
            seed.studio.agentHistory({
              agentId: currentAgent.id,
              versions: [currentAgentSettings],
            }),
            seed.studio.agentAnalytics(analytics),
          ),
          services: {
            agentAnalytics: buildMockAgentAnalyticsService(analytics),
          },
        }
      },
    ),
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
    withCategories: true,
  },

  decorators: [
    buildDecorator<StoryArgs>(
      ({ withAnalytics, withCategories, withMostlyEmptySessions, ...args }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents
        const currentAgent = agentFactory
          .transient({
            project,
          })
          .build({
            ...firstAgent,
            type: "conversation",
          })
        const currentAgentSettings = agentSettingsFactory.transient({ agent: currentAgent }).build({
          revision: currentAgent.currentRevision?.number ?? 1,
          hasCategories: withCategories,
        })

        const analytics = withAnalytics
          ? buildAnalytics(currentAgent, withMostlyEmptySessions ?? false)
          : {
              conversationsPerDay: [],
              avgUserQuestionsPerSessionPerDay: [],
              conversationsByCategoryPerDay: [],
              emptySessionsPerDay: [],
            }

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents([...restAgents, currentAgent], {
              currentId: currentAgent.id,
            }),
            seed.conversationAgentSessions({
              [currentAgent.id]: [],
            }),
            seed.studio.agentHistory({
              agentId: currentAgent.id,
              versions: [currentAgentSettings],
            }),
            seed.studio.agentAnalytics(analytics),
          ),

          services: {
            agentAnalytics: buildMockAgentAnalyticsService(analytics),
          },
        }
      },
    ),
  ],
}

/** An integration opens a session on every page load: the page warns about it. */
export const WithMostlyEmptySessions: Story = {
  ...WithData,
  args: { ...WithData.args, withMostlyEmptySessions: true },
}

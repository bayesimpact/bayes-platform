import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { agentFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { projectMembershipFactory, userFactory } from "@/common/features/me/me.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { buildMockStore } from "@/stories/decorators/with-redux"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  analyticsCategoryDailyPointFactory,
  analyticsDailyPointFactory,
} from "@/studio/features/analytics/project/analytics.factory"
import type { IProjectAnalyticsSpi } from "@/studio/features/analytics/project/analytics.spi"
import { buildStudioPath, StudioRouteNames } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = {
  role: ProjectMembershipRoleDto
  withAnalytics?: boolean
}

const ROLES: ProjectMembershipRoleDto[] = ["owner", "admin", "member"]

const DATES = ["2026-05-09", "2026-05-10", "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14"]

const organization = organizationFactory.build()
const project = projectFactory
  .transient({ organization })
  .build({ featureFlags: ["project-analytics"] })
const projectPath = buildStudioPath(StudioRouteNames.PROJECT_ANALYTICS)
  .replace(":organizationId", organization.id)
  .replace(":projectId", project.id)

function buildAnalytics(agents: Agent[]) {
  const conversationsPerDay = DATES.map((date) => analyticsDailyPointFactory.build({ date }))
  const avgUserQuestionsPerSessionPerDay = DATES.map((date) =>
    analyticsDailyPointFactory.build({ date }),
  )
  const conversationsByCategoryPerDay = DATES.flatMap((date) =>
    agents.flatMap((agent) =>
      analyticsCategoryDailyPointFactory.transient({ agent }).buildList(2, { date }),
    ),
  )
  return { conversationsPerDay, avgUserQuestionsPerSessionPerDay, conversationsByCategoryPerDay }
}

function buildMockProjectAnalyticsService(
  overrides: Partial<{
    conversationsPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    avgUserQuestionsPerSessionPerDay: ReturnType<typeof analyticsDailyPointFactory.build>[]
    conversationsByCategoryPerDay: ReturnType<typeof analyticsCategoryDailyPointFactory.build>[]
  }> = {},
): IProjectAnalyticsSpi {
  return {
    async getConversationsPerDay() {
      return overrides.conversationsPerDay ?? []
    },
    async getAvgUserQuestionsPerSessionPerDay() {
      return overrides.avgUserQuestionsPerSessionPerDay ?? []
    },
    async getConversationsByCategoryPerAgentPerDay() {
      return overrides.conversationsByCategoryPerDay ?? []
    },
  }
}

function buildDecorator(): Decorator {
  return (Story, ctx) => {
    const { role, withAnalytics } = ctx.args as StoryArgs
    const projectMemberships = [projectMembershipFactory.transient({ project }).build({ role })]
    const user = userFactory.transient({ projectMemberships }).build()
    const agents = agentFactory.transient({ project }).buildList(3)
    const analytics = withAnalytics
      ? buildAnalytics(agents)
      : {
          conversationsPerDay: [],
          avgUserQuestionsPerSessionPerDay: [],
          conversationsByCategoryPerDay: [],
        }
    const store = buildMockStore({
      state: mergeSeeds(
        seed.me(user),
        seed.organizations([organization], { currentId: organization.id }),
        seed.projects([project], { currentId: project.id }),
        seed.agents(agents),
        seed.studio.projectAnalytics(analytics),
      ),
      services: {
        projectAnalytics: buildMockProjectAnalyticsService(analytics),
      },
    })
    return (
      <Provider store={store}>
        <Story />
      </Provider>
    )
  }
}

const meta = {
  title: "routes/studio/project-analytics",
  parameters: { layout: "fullscreen" },
  argTypes: {
    role: { control: "select", options: ROLES },
    withAnalytics: { control: "boolean" },
  },
  args: {
    role: "owner",
    withAnalytics: false,
  },
  render: () => {
    const router = createMemoryRouter([studioRoutes], { initialEntries: [projectPath] })
    return <RouterProvider router={router} />
  },
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [buildDecorator()],
}

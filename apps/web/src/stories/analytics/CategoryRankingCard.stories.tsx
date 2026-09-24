import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { buildStoryCategoryPoints, buildStoryDates } from "@/stories/analytics/helpers"
import { CategoryRankingCard } from "@/studio/features/analytics/agent/components/CategoryRankingCard"

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()
const agent = agentFactory.transient({ project }).build({ name: "Helpful Assistant" })
const DATES = buildStoryDates("2026-05-10", 14)

const baseArgs = {
  allDates: DATES,
  title: "Conversations by category",
  description:
    "Categories ranked by conversation volume over the period. Click a row to see its daily volume.",
  noDataState: "No category session data for this period.",
  uncategorizedLabel: "Uncategorized",
}

const meta = {
  title: "analytics/CategoryRankingCard",
  component: CategoryRankingCard,
  parameters: { layout: "padded" },
  args: {
    ...baseArgs,
    points: buildStoryCategoryPoints({ agents: [agent], dates: DATES }),
  },
} satisfies Meta<typeof CategoryRankingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Ranking: Story = {}

export const WithoutUncategorized: Story = {
  args: {
    points: buildStoryCategoryPoints({ agents: [agent], dates: DATES, withUncategorized: false }),
  },
}

export const Empty: Story = {
  args: { points: [] },
}

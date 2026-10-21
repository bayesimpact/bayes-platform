import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withAgents?: boolean
  /** Adds a fresh copy of an agent: a draft that was never published. */
  withUnpublishedCopy?: boolean
}

const meta = {
  title: "routes/studio/project",
  parameters: { layout: "fullscreen" },
  argTypes: { ...studioStoryArgTypes, withUnpublishedCopy: { control: "boolean" } },
  args: {
    ...studioStoryArgs,
    featureFlags: [],
    withAgents: false,
    withUnpublishedCopy: false,
  },
  render: render({ path: StudioRoutes.project.path, routes: studioRoutes }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>((args) => {
      const { baseSeeds } = buildStudioData(args)
      return { state: mergeSeeds(baseSeeds) }
    }),
  ],
}

export const WithAgents: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
  },

  decorators: [
    buildDecorator<StoryArgs>(({ withUnpublishedCopy, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const unpublishedCopies = withUnpublishedCopy
        ? [
            agentFactory
              .unpublished()
              .transient({ project })
              .build({ name: "Customer Onboarding Assistant (copy)" }),
          ]
        : []
      return {
        state: mergeSeeds(baseSeeds, seed.agents([...agents, ...unpublishedCopies])),
      }
    }),
  ],
}

export const WithUnpublishedCopy: Story = {
  args: { ...WithAgents.args, withUnpublishedCopy: true },
  decorators: WithAgents.decorators,
}

export const WithAllFeatures: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: ["project-analytics"],
    withAgents: true,
  },

  decorators: [
    buildDecorator<StoryArgs>((args) => {
      const { baseSeeds } = buildStudioData(args)
      return {
        state: mergeSeeds(baseSeeds),
      }
    }),
  ],
}

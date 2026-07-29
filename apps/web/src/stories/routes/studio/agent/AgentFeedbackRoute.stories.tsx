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
import { agentMessageFeedbackFactory } from "@/studio/features/agent-message-feedback/agent-message-feedback.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withFeedbacks?: boolean
}

const meta = {
  title: "routes/studio/project/agent/feedback",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withFeedbacks: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withFeedbacks: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.feedback.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withFeedbacks, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: "conversation" })

      const feedbacks = withFeedbacks
        ? agentMessageFeedbackFactory.transient({ agent: currentAgent, project }).buildList(3)
        : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [] }),
          seed.studio.agentMessageFeedbacks({ [currentAgent.id]: feedbacks }),
        ),
      }
    }),
  ],
}

export const WithData: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    withFeedbacks: true,
  },
  decorators: Default.decorators,
}

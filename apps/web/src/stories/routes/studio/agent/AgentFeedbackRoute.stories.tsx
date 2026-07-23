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
  fillForm?: boolean
  withFeedbacks?: boolean
}

const meta = {
  title: "routes/studio/project/agent/feedback",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    fillForm: { control: "boolean" },
    withFeedbacks: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    fillForm: false,
    withFeedbacks: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.feedback.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ fillForm, withFeedbacks, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = (fillForm ? agentFactory.fillForm() : agentFactory)
        .transient({ project })
        .build({ ...firstAgent, type: "conversation", fillFormEnabled: !!fillForm })

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
    fillForm: false,
    withFeedbacks: true,
  },
  decorators: Default.decorators,
}

export const FillFormAgentWithData: Story = {
  args: {
    ...WithData.args,
    fillForm: true,
  },
  decorators: Default.decorators,
}

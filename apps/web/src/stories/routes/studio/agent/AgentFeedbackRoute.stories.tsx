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
import { agentMessageFeedbackFactory } from "@/studio/features/agent-message-feedback/agent-message-feedback.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type AgentType = Extract<Agent["type"], "conversation" | "form">

type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  withFeedbacks?: boolean
}

const meta = {
  title: "routes/studio/project/agent/feedback",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    agentType: {
      control: "select",
      options: ["conversation", "form"] satisfies AgentType[],
    },
    withFeedbacks: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    agentType: "conversation",
    withFeedbacks: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.feedback.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ agentType, withFeedbacks, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: agentType })

      const feedbacks = withFeedbacks
        ? agentMessageFeedbackFactory.transient({ agent: currentAgent, project }).buildList(3)
        : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [] }),
          seed.formAgentSessions({ [currentAgent.id]: [] }),
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
    agentType: "conversation",
    withFeedbacks: true,
  },

  decorators: [
    buildDecorator<StoryArgs>(({ agentType, withFeedbacks, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({
          project,
        })
        .build({
          ...firstAgent,
          type: agentType,
        })

      const feedbacks = withFeedbacks
        ? agentMessageFeedbackFactory
            .transient({
              agent: currentAgent,
              project,
            })
            .buildList(3)
        : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], {
            currentId: currentAgent.id,
          }),
          seed.conversationAgentSessions({
            [currentAgent.id]: [],
          }),
          seed.formAgentSessions({
            [currentAgent.id]: [],
          }),
          seed.studio.agentMessageFeedbacks({
            [currentAgent.id]: feedbacks,
          }),
        ),
      }
    }),
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  conversationAgentSessionFactory,
  extractionAgentSessionSummaryFactory,
  formAgentSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildDecorator, render } from "@/stories/decorators"
import { sortRecentlyCreated } from "@/stories/helpers"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type AgentType = Agent["type"]

type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  withAgentSessions?: boolean
}

const meta = {
  title: "routes/studio/project/agent",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    agentType: {
      control: "select",
      options: ["conversation", "form", "extraction"] satisfies AgentType[],
    },
    withAgentSessions: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    agentType: "conversation",
    withAgentSessions: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agent.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ agentType, withAgentSessions, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: agentType })

      const conversationSessions =
        withAgentSessions && agentType === "conversation"
          ? conversationAgentSessionFactory
              .transient({ agent: currentAgent })
              .buildList(3)
              .sort(sortRecentlyCreated)
          : []
      const formSessions =
        withAgentSessions && agentType === "form"
          ? formAgentSessionFactory
              .transient({ agent: currentAgent })
              .buildList(3)
              .sort(sortRecentlyCreated)
          : []
      const extractionSessions =
        withAgentSessions && agentType === "extraction"
          ? extractionAgentSessionSummaryFactory
              .transient({ agent: currentAgent })
              .buildList(3)
              .sort(sortRecentlyCreated)
          : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: conversationSessions }),
          seed.formAgentSessions({ [currentAgent.id]: formSessions }),
          seed.extractionAgentSessions({ [currentAgent.id]: extractionSessions }),
        ),
      }
    }),
  ],
}

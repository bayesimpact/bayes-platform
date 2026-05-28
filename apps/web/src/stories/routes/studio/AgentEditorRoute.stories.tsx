import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { agentSubAgentFactory } from "@/studio/features/agent-sub-agents/agent-sub-agents.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withSubAgents?: boolean
}

const meta = {
  title: "routes/studio/project/agent/edit",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withSubAgents: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "agent-orchestration"],
    withAgents: true,
    withSubAgents: true,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentEdit.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationAgent: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withSubAgents, ...args }) => {
      const { baseSeeds, agents } = buildStudioData({ ...args, withAgents: true })
      const [rawParentAgent, ...rawChildAgents] = agents
      if (!rawParentAgent) {
        throw new Error("Agent editor route story requires a parent agent")
      }
      const parentAgent = {
        ...rawParentAgent,
        name: "Helpful Assistant",
        type: "conversation" as const,
      }
      const childAgents = rawChildAgents.map((agent, index) => ({
        ...agent,
        name: index === 0 ? "Research Agent" : "Summary Bot",
        type: "conversation" as const,
      }))
      const subAgents =
        withSubAgents && childAgents[0]
          ? [
              agentSubAgentFactory
                .transient({ parentAgent, childAgent: childAgents[0] })
                .build({
                  toolName: "ask_research_agent",
                  description: "Use for research and source discovery questions.",
                }),
            ]
          : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([parentAgent, ...childAgents], { currentId: parentAgent.id }),
          seed.studio.agentSubAgents(subAgents),
          seed.studio.documentTags([]),
        ),
      }
    }),
  ],
}

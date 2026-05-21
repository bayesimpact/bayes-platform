import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentMembershipFactory } from "@/common/features/me/me.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import type { IAgentMembershipsSpi } from "@/studio/features/agent-memberships/agent-memberships.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withMemberships?: boolean
}

function buildMockAgentMembershipsService(
  overrides: { memberships?: AgentMembership[] } = {},
): IAgentMembershipsSpi {
  const memberships = overrides.memberships ?? []
  return {
    async getAll() {
      return memberships
    },
    async remove() {},
  }
}

const meta = {
  title: "routes/studio/project/agent/memberships",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withMemberships: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withMemberships: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.agentMemberships.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withMemberships, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: "conversation" })

      const memberships = withMemberships
        ? [
            agentMembershipFactory.transient({ agent: currentAgent }).build({ role: "owner" }),
            agentMembershipFactory.transient({ agent: currentAgent }).build({ role: "member" }),
            agentMembershipFactory.transient({ agent: currentAgent }).build({ role: "member" }),
          ]
        : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([currentAgent, ...restAgents], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [] }),
          seed.studio.agentMemberships(memberships),
        ),
        services: {
          agentMemberships: buildMockAgentMembershipsService({ memberships }),
        },
      }
    }),
  ],
}

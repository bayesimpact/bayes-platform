import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { buildDecorator, render } from "@/stories/decorators"
import { buildMockProjectMembershipsService } from "@/stories/project-memberships/mock-services"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { agentMembershipFactory } from "@/studio/features/agent-memberships/agent-memberships.factory"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import type { IAgentMembershipsSpi } from "@/studio/features/agent-memberships/agent-memberships.spi"
import { pendingInvitationFactory } from "@/studio/features/invitations/invitations.factory"
import { SAMPLE_AGENT_ROLES } from "@/studio/features/project-memberships/project-memberships.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withMemberships?: boolean
  withPendingInvitations?: boolean
}

function buildMockAgentMembershipsService(
  overrides: { memberships?: AgentMembership[] } = {},
): IAgentMembershipsSpi {
  const memberships = overrides.memberships ?? []
  return {
    async getAll() {
      return memberships
    },
    async addRoles() {},
    async removeMany() {},
  }
}

const meta = {
  title: "routes/studio/project/agent/members",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withMemberships: { control: "boolean" },
    withPendingInvitations: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withMemberships: true,
    withPendingInvitations: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.agentMemberships.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

const decorator = buildDecorator<StoryArgs>(
  ({ withMemberships, withPendingInvitations, ...args }) => {
    const { baseSeeds, project, agents, user } = buildStudioData(args)
    const [firstAgent, ...restAgents] = agents
    // The first agent carries the viewer's permissions from their roles.
    const currentAgent = agentFactory
      .transient({ project })
      .build({ ...firstAgent, type: "conversation" })
    // StudioAgentRoute waits for the agent settings before rendering its children.
    const currentAgentSettings = agentSettingsFactory
      .transient({ agent: currentAgent })
      .build({ revision: currentAgent.currentRevision?.number ?? 1 })

    // The viewer is the agent's owner; the others hold one or several roles.
    const viewer = agentMembershipFactory
      .transient({ agent: currentAgent, role: "owner" })
      .build({ userId: user.id, userName: user.name, userEmail: user.email })
    const memberships = withMemberships
      ? [
          viewer,
          agentMembershipFactory
            .transient({ agent: currentAgent })
            .build({ roles: [SAMPLE_AGENT_ROLES[1]!, SAMPLE_AGENT_ROLES[2]!] }),
          agentMembershipFactory.transient({ agent: currentAgent }).build(),
          agentMembershipFactory
            .transient({ agent: currentAgent })
            .build({ userHasSignedIn: false }),
        ]
      : [viewer]

    return {
      state: mergeSeeds(
        baseSeeds,
        seed.agents([currentAgent, ...restAgents], { currentId: currentAgent.id }),
        seed.conversationAgentSessions({ [currentAgent.id]: [] }),
        seed.studio.agentMemberships(memberships),
        seed.studio.agentAssignableRoles(SAMPLE_AGENT_ROLES),
        seed.studio.agentHistory({ agentId: currentAgent.id, versions: [currentAgentSettings] }),
        seed.studio.agentPendingInvitations(
          withPendingInvitations
            ? pendingInvitationFactory.buildList(2, {
                targetType: "agent",
                targetId: currentAgent.id,
                targetName: currentAgent.name,
              })
            : [],
        ),
      ),
      services: {
        agentMemberships: buildMockAgentMembershipsService({ memberships }),
        projectMemberships: buildMockProjectMembershipsService(),
      },
    }
  },
)

/** An agent owner's view: members with one or several roles, one who never signed in. */
export const Default: Story = {
  decorators: [decorator],
}

/** A new agent: the viewer is its only member. */
export const OnlyMe: Story = {
  args: { withMemberships: false },
  decorators: [decorator],
}

export const WithPendingInvitations: Story = {
  args: { withPendingInvitations: true },
  decorators: [decorator],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/common/features/agents/agent-sessions/agent-session.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { pendingInvitationFactory } from "@/studio/features/invitations/invitations.factory"
import { projectMembershipFactory } from "@/studio/features/project-memberships/project-memberships.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withMemberships?: boolean
  withNeverSignedInMembers?: boolean
  withPendingInvitations?: boolean
}

const meta = {
  title: "routes/studio/project/memberships",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withMemberships: { control: "boolean" },
    withNeverSignedInMembers: { control: "boolean" },
    withPendingInvitations: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withMemberships: false,
    withNeverSignedInMembers: false,
    withPendingInvitations: false,
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.projectMemberships.path,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({ withMemberships, withNeverSignedInMembers, withPendingInvitations, ...args }) => {
        const { baseSeeds, project } = buildStudioData(args)
        const memberships = withMemberships
          ? [
              projectMembershipFactory.transient({ project }).build({ role: "owner" }),
              projectMembershipFactory.transient({ project }).build({ role: "admin" }),
              projectMembershipFactory.transient({ project }).build({ role: "member" }),
            ]
          : [projectMembershipFactory.transient({ project }).build({ role: "owner" })]
        const neverSignedInMembers = withNeverSignedInMembers
          ? [
              projectMembershipFactory
                .transient({ project })
                .build({ role: "admin", userHasSignedIn: false }),
            ]
          : []
        return {
          state: mergeSeeds(
            baseSeeds,
            seed.studio.projectMemberships([...memberships, ...neverSignedInMembers]),
            seed.studio.projectPendingInvitations(
              withPendingInvitations
                ? pendingInvitationFactory.buildList(2, {
                    projectId: project.id,
                    targetId: project.id,
                    projectName: project.name,
                  })
                : [],
            ),
          ),
        }
      },
    ),
  ],
}

export const WithMembers: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    withMemberships: true,
    withNeverSignedInMembers: true,
    withPendingInvitations: true,
  },

  decorators: [
    buildDecorator<StoryArgs>(
      ({ withMemberships, withNeverSignedInMembers, withPendingInvitations, ...args }) => {
        const { baseSeeds, project } = buildStudioData(args)
        const memberships = withMemberships
          ? [
              projectMembershipFactory
                .transient({
                  project,
                })
                .build({
                  role: "owner",
                }),
              projectMembershipFactory
                .transient({
                  project,
                })
                .build({
                  role: "admin",
                }),
              projectMembershipFactory
                .transient({
                  project,
                })
                .build({
                  role: "member",
                }),
            ]
          : [
              projectMembershipFactory
                .transient({
                  project,
                })
                .build({
                  role: "owner",
                }),
            ]
        const neverSignedInMembers = withNeverSignedInMembers
          ? [
              projectMembershipFactory
                .transient({ project })
                .build({ role: "admin", userHasSignedIn: false }),
            ]
          : []
        return {
          state: mergeSeeds(
            baseSeeds,
            seed.studio.projectMemberships([...memberships, ...neverSignedInMembers]),
            seed.studio.projectPendingInvitations(
              withPendingInvitations
                ? pendingInvitationFactory.buildList(2, {
                    projectId: project.id,
                    targetId: project.id,
                    projectName: project.name,
                  })
                : [],
            ),
          ),
        }
      },
    ),
  ],
}

/**
 * Reached from an agent page: that agent's sessions are still cached while the URL no
 * longer has an agent id. The sidebar must render without a current agent.
 */
export const WithCachedAgentSessions: Story = {
  args: { withAgents: true },
  decorators: [
    buildDecorator<StoryArgs>(
      ({ withMemberships, withNeverSignedInMembers, withPendingInvitations, ...args }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents
        const conversationAgent = agentFactory
          .transient({ project })
          .build({ ...firstAgent, type: "conversation" })
        const sessions = conversationAgentSessionFactory
          .transient({ agent: conversationAgent })
          .buildList(2)
        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents([conversationAgent, ...restAgents]),
            seed.conversationAgentSessions({ [conversationAgent.id]: sessions }),
            seed.studio.projectMemberships([
              projectMembershipFactory.transient({ project }).build({ role: "owner" }),
            ]),
          ),
        }
      },
    ),
  ],
}

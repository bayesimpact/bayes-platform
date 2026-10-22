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
import {
  projectMembershipFactory,
  SAMPLE_PROJECT_ROLES,
} from "@/studio/features/project-memberships/project-memberships.factory"
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

/** The viewer's own membership: the table marks it and keeps it out of the selection. */
const viewer = (user: { id: string; name: string; email: string }) => ({
  userId: user.id,
  userName: user.name,
  userEmail: user.email,
})

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({ withMemberships, withNeverSignedInMembers, withPendingInvitations, ...args }) => {
        const { baseSeeds, project, user } = buildStudioData(args)
        const memberships = withMemberships
          ? [
              projectMembershipFactory.transient({ project, role: "owner" }).build(viewer(user)),
              projectMembershipFactory.transient({ project, role: "admin" }).build(),
              projectMembershipFactory.transient({ project, role: "member" }).build(),
            ]
          : [projectMembershipFactory.transient({ project, role: "owner" }).build(viewer(user))]
        const neverSignedInMembers = withNeverSignedInMembers
          ? [
              projectMembershipFactory
                .transient({ project, role: "admin" })
                .build({ userHasSignedIn: false }),
            ]
          : []
        return {
          state: mergeSeeds(
            baseSeeds,
            seed.studio.projectMemberships([...memberships, ...neverSignedInMembers]),
            seed.studio.projectAssignableRoles(SAMPLE_PROJECT_ROLES),
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
        const { baseSeeds, project, user } = buildStudioData(args)
        const memberships = withMemberships
          ? [
              projectMembershipFactory.transient({ project, role: "owner" }).build(viewer(user)),
              projectMembershipFactory.transient({ project, role: "admin" }).build(),
              projectMembershipFactory.transient({ project, role: "member" }).build(),
            ]
          : [projectMembershipFactory.transient({ project, role: "owner" }).build(viewer(user))]
        const neverSignedInMembers = withNeverSignedInMembers
          ? [
              projectMembershipFactory
                .transient({ project, role: "admin" })
                .build({ userHasSignedIn: false }),
            ]
          : []
        return {
          state: mergeSeeds(
            baseSeeds,
            seed.studio.projectMemberships([...memberships, ...neverSignedInMembers]),
            seed.studio.projectAssignableRoles(SAMPLE_PROJECT_ROLES),
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
        const { baseSeeds, project, agents, user } = buildStudioData(args)
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
              projectMembershipFactory.transient({ project, role: "owner" }).build(viewer(user)),
            ]),
            seed.studio.projectAssignableRoles(SAMPLE_PROJECT_ROLES),
          ),
        }
      },
    ),
  ],
}

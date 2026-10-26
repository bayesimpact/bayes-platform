import type { Meta, StoryObj } from "@storybook/react-vite"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"
import { buildDecorator, render } from "@/stories/decorators"
import { buildMockProjectMembershipsService } from "@/stories/project-memberships/mock-services"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  memberRolesFactory,
  projectMembershipFactory,
  SAMPLE_ASSIGNABLE_ROLES,
} from "@/studio/features/project-memberships/project-memberships.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  memberRole?: LegacyMembershipRole
}

const FIXED_MEMBER_USER_ID = "member-user-fixture-1"

const meta = {
  title: "routes/studio/project/member",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    memberRole: { control: "select", options: ["owner", "admin", "member"] },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    memberRole: "member",
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.projectMembership.path.replace(":memberUserId", FIXED_MEMBER_USER_ID),
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

const decorator = buildDecorator<StoryArgs>(({ memberRole, ...args }) => {
  const { baseSeeds, project, agents } = buildStudioData(args)
  const membership = projectMembershipFactory
    .transient({ project, role: memberRole ?? "member" })
    .build({ userId: FIXED_MEMBER_USER_ID })
  const memberships = [
    membership,
    projectMembershipFactory.transient({ project, role: "owner" }).build(),
  ]
  const memberRoles = memberRolesFactory
    .transient({ membership, projectName: project.name, agents })
    .build()

  return {
    state: mergeSeeds(
      baseSeeds,
      seed.studio.projectMemberships(memberships),
      seed.studio.projectMemberRoles(memberRoles),
      // The members route above this page waits for both.
      seed.studio.assignableRoles(SAMPLE_ASSIGNABLE_ROLES),
      seed.studio.projectPendingInvitations([]),
      seed.currentMemberUserId(FIXED_MEMBER_USER_ID),
    ),
    services: {
      projectMemberships: buildMockProjectMembershipsService({ memberships, memberRoles }),
    },
  }
})

/** A member with roles on the workspace, an agent and a campaign, as a manager sees them. */
export const Default: Story = {
  decorators: [decorator],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  projectMemberAgentFactory,
  projectMembershipFactory,
} from "@/studio/features/project-memberships/project-memberships.factory"
import type {
  ProjectMemberAgent,
  ProjectMembership,
} from "@/studio/features/project-memberships/project-memberships.models"
import type { IProjectMembershipsSpi } from "@/studio/features/project-memberships/project-memberships.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withMemberAgents?: boolean
  memberRole?: ProjectMembership["role"]
}

const FIXED_MEMBERSHIP_ID = "membership-fixture-1"

function buildMockProjectMembershipsService(
  overrides: { memberships?: ProjectMembership[]; memberAgents?: ProjectMemberAgent[] } = {},
): IProjectMembershipsSpi {
  return {
    async getAll() {
      return overrides.memberships ?? []
    },
    async updateOne({ membershipId, role }) {
      const membership = overrides.memberships?.find((item) => item.id === membershipId)
      if (!membership) throw new Error(`Unknown membership ${membershipId}`)
      return { ...membership, role }
    },
    async remove() {},
    async getMemberAgents() {
      return overrides.memberAgents ?? []
    },
  }
}

const meta = {
  title: "routes/studio/project/membership",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    withMemberAgents: { control: "boolean" },
    memberRole: { control: "select", options: ["owner", "admin", "member"] },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    withMemberAgents: false,
    memberRole: "member",
  },
  render: render({
    routes: studioRoutes,
    path: StudioRoutes.projectMembership.path.replace(":membershipId", FIXED_MEMBERSHIP_ID),
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withMemberAgents, memberRole, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const membership = projectMembershipFactory
        .transient({ project })
        .build({ id: FIXED_MEMBERSHIP_ID, role: memberRole ?? "member" })
      const otherMemberships = [
        projectMembershipFactory.transient({ project }).build({ role: "owner" }),
      ]
      const memberAgents = withMemberAgents
        ? agents.map((agent, index) =>
            projectMemberAgentFactory
              .transient({ agent, membership })
              .build(index === agents.length - 1 ? { membershipId: null, role: null } : {}),
          )
        : []
      const memberships = [membership, ...otherMemberships]

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.projectMemberships(memberships),
          seed.studio.projectMemberAgents(memberAgents),
          seed.currentMembershipId(FIXED_MEMBERSHIP_ID),
        ),
        services: {
          projectMemberships: buildMockProjectMembershipsService({
            memberships,
            memberAgents,
          }),
        },
      }
    }),
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { projectMembershipFactory } from "@/studio/features/project-memberships/project-memberships.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withMemberships?: boolean
  withNeverSignedInMembers?: boolean
}

const meta = {
  title: "routes/studio/project/memberships",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withMemberships: { control: "boolean" },
    withNeverSignedInMembers: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withMemberships: false,
    withNeverSignedInMembers: false,
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
    buildDecorator<StoryArgs>(({ withMemberships, withNeverSignedInMembers, ...args }) => {
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
        ),
      }
    }),
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
  },

  decorators: [
    buildDecorator<StoryArgs>(({ withMemberships, withNeverSignedInMembers, ...args }) => {
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
        ),
      }
    }),
  ],
}

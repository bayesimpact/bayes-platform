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
}

const meta = {
  title: "routes/studio/project/memberships",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withMemberships: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withMemberships: false,
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
    buildDecorator<StoryArgs>(({ withMemberships, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const memberships = withMemberships
        ? [
            projectMembershipFactory.transient({ project }).build({ role: "owner" }),
            projectMembershipFactory.transient({ project }).build({ role: "admin" }),
            projectMembershipFactory.transient({ project }).build({ role: "member" }),
          ]
        : []
      return {
        state: mergeSeeds(baseSeeds, seed.studio.projectMemberships(memberships)),
      }
    }),
  ],
}

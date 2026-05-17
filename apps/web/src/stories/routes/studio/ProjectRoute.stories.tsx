import type { Meta, StoryObj } from "@storybook/react-vite"
import { RouteNames } from "@/common/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds } from "@/stories/seed"
import { buildStudioPath } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withAgents?: boolean
}

const meta = {
  title: "routes/studio/project",
  parameters: { layout: "fullscreen" },
  argTypes: studioStoryArgTypes,
  args: {
    ...studioStoryArgs,
    featureFlags: [],
    withAgents: false,
  },
  render: render({ path: buildStudioPath(RouteNames.PROJECT), routes: studioRoutes }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>((args) => {
      const { baseSeeds } = buildStudioData(args)
      return { state: mergeSeeds(baseSeeds) }
    }),
  ],
}

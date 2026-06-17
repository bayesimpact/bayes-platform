import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { resourceLibraryFactory } from "@/studio/features/resource-libraries/resource-libraries.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withLibraries?: boolean
}

const meta = {
  title: "routes/studio/project/resource-libraries",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withLibraries: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withLibraries: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.resourceLibraries.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withLibraries: _withLibraries, ...args }) => {
      const { baseSeeds } = buildStudioData(args)
      return { state: mergeSeeds(baseSeeds, seed.studio.resourceLibraries([])) }
    }),
  ],
}

export const WithLibraries: Story = {
  args: { withLibraries: true },
  decorators: [
    buildDecorator<StoryArgs>(({ withLibraries, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const resourceLibraries = withLibraries
        ? resourceLibraryFactory.transient({ project }).buildList(3)
        : []
      return { state: mergeSeeds(baseSeeds, seed.studio.resourceLibraries(resourceLibraries)) }
    }),
  ],
}

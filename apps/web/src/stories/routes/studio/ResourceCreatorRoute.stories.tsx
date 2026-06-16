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

const EXISTING_LIBRARY_ID = "11111111-1111-1111-1111-111111111111"

const meta = {
  title: "routes/studio/project/resource-libraries/resource-creator",
  parameters: { layout: "fullscreen" },
  argTypes: studioStoryArgTypes,
  args: studioStoryArgs,
  render: render({ routes: studioRoutes, path: StudioRoutes.resourceNew.path }),
} satisfies Meta<StudioStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  decorators: [
    buildDecorator<StudioStoryArgs>((args) => {
      const { baseSeeds, project } = buildStudioData(args)
      const resourceLibrary = resourceLibraryFactory.transient({ project }).build({
        id: EXISTING_LIBRARY_ID,
        title: "Getting Started",
        resources: [],
      })
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.resourceLibraries([resourceLibrary]),
          seed.currentResourceLibraryId(EXISTING_LIBRARY_ID),
        ),
      }
    }),
  ],
}

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
  buildResource,
  resourceLibraryFactory,
} from "@/studio/features/resource-libraries/resource-libraries.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

const EXISTING_LIBRARY_ID = "11111111-1111-1111-1111-111111111111"

const meta = {
  title: "routes/studio/project/resource-libraries/editor",
  parameters: { layout: "fullscreen" },
  argTypes: studioStoryArgTypes,
  args: studioStoryArgs,
  render: render({ routes: studioRoutes, path: StudioRoutes.resourceLibraryNew.path }),
} satisfies Meta<StudioStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  decorators: [
    buildDecorator<StudioStoryArgs>((args) => {
      const { baseSeeds } = buildStudioData(args)
      return { state: mergeSeeds(baseSeeds, seed.studio.resourceLibraries([])) }
    }),
  ],
}

export const Edit: Story = {
  render: render({ routes: studioRoutes, path: StudioRoutes.resourceLibrary.path }),
  decorators: [
    buildDecorator<StudioStoryArgs>((args) => {
      const { baseSeeds, project } = buildStudioData(args)
      const resourceLibrary = resourceLibraryFactory.transient({ project }).build({
        id: EXISTING_LIBRARY_ID,
        title: "Getting Started",
        resources: [
          buildResource({ linkType: "url", title: "Onboarding guide" }),
          buildResource({ linkType: "url", title: "Pricing overview" }),
        ],
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

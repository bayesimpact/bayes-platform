import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { documentTagFactory } from "@/studio/features/document-tags/document-tags.factory"
import { documentFactory } from "@/studio/features/documents/documents.factory"
import { buildStudioPath, StudioRouteNames } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withDocumentTags?: boolean
  withDocuments?: boolean
}

const meta = {
  title: "routes/studio/documents",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withDocuments: { control: "boolean" },
    withDocumentTags: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withDocuments: false,
    withDocumentTags: false,
  },
  render: render({ routes: studioRoutes, path: buildStudioPath(StudioRouteNames.DOCUMENTS) }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withDocuments, withDocumentTags, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const documents = withDocuments
        ? [
            documentFactory.transient({ project }).build(),
            documentFactory.transient({ project }).build({ embeddingStatus: "pending" }),
            documentFactory.transient({ project }).build({ embeddingStatus: "processing" }),
            documentFactory
              .transient({ project })
              .build({ embeddingError: "Some error message", embeddingStatus: "failed" }),
          ]
        : []
      const documentTags = withDocumentTags
        ? documentTagFactory.transient({ project }).buildList(3)
        : []
      return {
        state: mergeSeeds(
          baseSeeds,
          seed.studio.documents(documents),
          seed.studio.documentTags(documentTags),
        ),
      }
    }),
  ],
}

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
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withDocumentTags?: boolean
  withDocuments?: boolean
}

const meta = {
  title: "routes/studio/project/web-sources",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withDocuments: { control: "boolean" },
    withDocumentTags: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: ["web_sources"],
    withDocuments: false,
    withDocumentTags: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.webSources.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withDocuments, withDocumentTags, ...args }) => {
      const { baseSeeds, project } = buildStudioData(args)
      const documents = withDocuments
        ? [
            documentFactory.transient({ project }).build({ sourceType: "webCrawl" }),
            documentFactory
              .transient({ project })
              .build({ sourceType: "webCrawl", embeddingStatus: "pending" }),
            documentFactory
              .transient({ project })
              .build({ sourceType: "webCrawl", embeddingStatus: "processing" }),
            documentFactory.transient({ project }).build({
              sourceType: "webCrawl",
              embeddingError: "Some error message",
              embeddingStatus: "failed",
            }),
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

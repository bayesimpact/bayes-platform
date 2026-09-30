import { DOCUMENT_SOURCE_READ_PERMISSION } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { myProjectFactory } from "@/common/features/projects/projects.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { documentSourceFactory } from "@/studio/features/document-sources/document-sources.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withSources?: boolean
}

const meta = {
  title: "routes/studio/project/external",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withSources: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withSources: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.externalSources.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

function studioState({ withSources, ...args }: StoryArgs) {
  const { baseSeeds, organization, project } = buildStudioData(args)
  const myProject = myProjectFactory.transient({ organization }).build({
    id: project.id,
    name: project.name,
    permissions: [DOCUMENT_SOURCE_READ_PERMISSION],
  })
  const documentSources = withSources
    ? [
        documentSourceFactory.transient({ project }).build({
          name: "Helpful Assistant",
          type: "site-crawler",
          baseUrl: "https://example.com/docs",
          documentCount: 12,
          indexedDocumentCount: 12,
          status: "ready",
        }),
        documentSourceFactory.transient({ project }).build({
          name: "Pricing notes",
          type: "folder",
          baseUrl: null,
          externalId: "library/pricing",
          documentCount: 4,
          indexedDocumentCount: 3,
          status: "error",
        }),
      ]
    : []
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.myProjects([myProject]),
      seed.studio.documentSources(documentSources),
    ),
  }
}

export const Default: Story = {
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const WithData: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    withSources: true,
  },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

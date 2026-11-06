import {
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE,
} from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { documentSourceFactory } from "@/studio/features/document-sources/document-sources.factory"
import { documentTagFactory } from "@/studio/features/document-tags/document-tags.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withSources?: boolean
  withLegacyWebCrawlSources?: boolean
  canUpdate?: boolean
}

const meta = {
  title: "routes/studio/project/external",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withSources: { control: "boolean" },
    withLegacyWebCrawlSources: { control: "boolean" },
    canUpdate: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withSources: false,
    withLegacyWebCrawlSources: false,
    canUpdate: true,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.externalSources.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

function studioState({ withSources, withLegacyWebCrawlSources, canUpdate, ...args }: StoryArgs) {
  const { baseSeeds, project } = buildStudioData(args)
  const readableProject = {
    ...project,
    permissions: canUpdate
      ? [DOCUMENT_SOURCE_READ_PERMISSION, DOCUMENT_SOURCE_UPDATE_PERMISSION]
      : [DOCUMENT_SOURCE_READ_PERMISSION],
  }
  const documentTags = ["Product", "Pricing", "Support"].map((name) =>
    documentTagFactory.transient({ project: readableProject }).build({ name }),
  )
  const [productTag, pricingTag] = documentTags
  const documentSources = withSources
    ? [
        documentSourceFactory.transient({ project: readableProject }).build({
          name: "Helpful Assistant",
          type: "site",
          baseUrl:
            "https://www.example.com/resources/culture-and-support-essential-levers-for-the-knowledge-base/",
          app: { name: "Helpful Assistant", logoUrl: "https://placehold.co/52x52/png" },
          documentCount: 12,
          indexedDocumentCount: 12,
          status: "ready",
          tagIds: [productTag!.id, pricingTag!.id],
        }),
        documentSourceFactory.transient({ project: readableProject }).build({
          name: "Support center",
          type: "site",
          baseUrl: "https://support.example.com/",
          app: {
            name: "Site crawler",
            logoUrl: "https://placehold.co/160x40/png?text=Site+crawler",
          },
          documentCount: 38,
          indexedDocumentCount: 38,
          status: "ready",
        }),
        documentSourceFactory.transient({ project: readableProject }).build({
          name: "Pricing notes",
          type: "folder",
          baseUrl: null,
          externalId: "library/pricing",
          app: null,
          documentCount: 4,
          indexedDocumentCount: 3,
          status: "error",
        }),
      ]
    : []
  const legacyWebCrawlSources = withLegacyWebCrawlSources
    ? [
        documentSourceFactory.transient({ project: readableProject }).build({
          name: "Product documentation",
          type: LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE,
          baseUrl: "https://docs.example.com/",
          externalId: `${LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE}:sample`,
          app: null,
          lastSyncedAt: null,
          documentCount: 24,
          indexedDocumentCount: 24,
          status: "ready",
        }),
      ]
    : []
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.projects([readableProject], { currentId: readableProject.id }),
      seed.studio.documentSources([...documentSources, ...legacyWebCrawlSources]),
      seed.studio.documentTags(documentTags),
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

export const ReadOnlyTags: Story = {
  args: { ...WithData.args, canUpdate: false },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const WithLegacyWebCrawlSources: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    withSources: true,
    withLegacyWebCrawlSources: true,
  },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

import { PROJECT_APP_INSTALLATION_READ_PERMISSION } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { appInstallationFactory } from "@/studio/features/app-installations/app-installations.factory"
import type { AppInstallation } from "@/studio/features/app-installations/app-installations.models"
import type { IAppInstallationsSpi } from "@/studio/features/app-installations/app-installations.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withApps?: boolean
}

function buildMockAppInstallationsService(
  overrides: { appInstallations?: AppInstallation[] } = {},
): IAppInstallationsSpi {
  const appInstallations = overrides.appInstallations ?? []
  return {
    async getAll() {
      return appInstallations
    },
  }
}

const meta = {
  title: "routes/studio/project/apps",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withApps: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withApps: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.appInstallations.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

function studioState({ withApps, ...args }: StoryArgs) {
  const { baseSeeds, project } = buildStudioData(args)
  const readableProject = { ...project, permissions: [PROJECT_APP_INSTALLATION_READ_PERMISSION] }
  const appInstallations = withApps
    ? [
        appInstallationFactory.transient({ project: readableProject }).build({
          appName: "Helpful Assistant",
          logoUrl: "https://placehold.co/52x52/png",
          permissions: ["document.read", "document.create", "document_tag.read"],
        }),
        appInstallationFactory.transient({ project: readableProject }).build({
          appName: "Site Crawler",
          description: null,
          permissions: ["agent.read", "agent.conversation.session.external.create"],
        }),
        appInstallationFactory.transient({ project: readableProject }).build({
          appName: "Pricing Sync",
          permissions: [],
        }),
      ]
    : []
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.projects([readableProject], { currentId: readableProject.id }),
      seed.studio.appInstallations(appInstallations),
    ),
    services: { appInstallations: buildMockAppInstallationsService({ appInstallations }) },
  }
}

export const Empty: Story = {
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const WithApps: Story = {
  args: { withApps: true },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

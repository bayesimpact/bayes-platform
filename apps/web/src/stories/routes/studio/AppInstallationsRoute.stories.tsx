import {
  PROJECT_APP_INSTALLATION_READ_PERMISSION,
  PROJECT_APP_INSTALLATION_REVOKE_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
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
  canRevoke?: boolean
  withCatalogFlag?: boolean
}

function buildMockAppInstallationsService(
  overrides: { appInstallations?: AppInstallation[] } = {},
): IAppInstallationsSpi {
  const appInstallations = overrides.appInstallations ?? []
  return {
    async getAll() {
      return appInstallations
    },
    async revokeOne() {},
  }
}

const meta = {
  title: "routes/studio/project/apps",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withApps: { control: "boolean" },
    canRevoke: { control: "boolean" },
    withCatalogFlag: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withApps: false,
    canRevoke: true,
    withCatalogFlag: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.appInstallations.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

function studioState({ withApps, canRevoke, withCatalogFlag, ...args }: StoryArgs) {
  const featureFlags = withCatalogFlag
    ? [...(args.featureFlags ?? []), "apps-catalog" as const]
    : args.featureFlags
  const { baseSeeds, project } = buildStudioData({ ...args, featureFlags })
  const readableProject = {
    ...project,
    featureFlags: featureFlags ?? project.featureFlags,
    permissions: canRevoke
      ? [PROJECT_APP_INSTALLATION_READ_PERMISSION, PROJECT_APP_INSTALLATION_REVOKE_PERMISSION]
      : [PROJECT_APP_INSTALLATION_READ_PERMISSION],
  }
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

/** Opens the permissions of the first app, the way someone clicks its button. */
const openFirstPermissions = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const [button] = await canvas.findAllByRole("button", { name: /permissions?$/ })
  if (button) await userEvent.click(button)
}

export const Empty: Story = {
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const WithApps: Story = {
  args: { withApps: true },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const WithCatalogButton: Story = {
  args: { withApps: true, withCatalogFlag: true },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const PermissionsDialog: Story = {
  args: { withApps: true },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
  play: async ({ canvasElement }) => {
    await openFirstPermissions(canvasElement)
  },
}

export const RevokeMenu: Story = {
  args: { withApps: true },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [menuButton] = await canvas.findAllByRole("button", { name: /^(More|Plus)$/ })
    // The menu opens on pointerdown, which a simulated click does not send: open it from the keyboard.
    if (!menuButton) return
    menuButton.focus()
    await userEvent.keyboard("{Enter}")
  },
}

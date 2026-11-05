import {
  PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
  PROJECT_APP_INSTALLATION_READ_PERMISSION,
  PROJECT_APP_INSTALLATION_REVOKE_PERMISSION,
} from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import type { Project } from "@/common/features/projects/projects.models"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { appCatalogEntryFactory } from "@/studio/features/app-catalog/app-catalog.factory"
import type { AppCatalogEntry } from "@/studio/features/app-catalog/app-catalog.models"
import type { IAppCatalogSpi } from "@/studio/features/app-catalog/app-catalog.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withApps?: boolean
  withInstalledApp?: boolean
  canInstall?: boolean
}

function buildMockAppCatalogService(
  overrides: { entries?: AppCatalogEntry[] } = {},
): IAppCatalogSpi {
  const entries = overrides.entries ?? []
  return {
    async getAll() {
      return entries
    },
  }
}

const meta = {
  title: "routes/studio/project/apps-catalog",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withApps: { control: "boolean" },
    withInstalledApp: { control: "boolean" },
    canInstall: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "apps-catalog"],
    withApps: true,
    withInstalledApp: false,
    canInstall: true,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.appCatalog.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

function buildEntries(project: Project, withInstalledApp: boolean): AppCatalogEntry[] {
  return [
    appCatalogEntryFactory.transient({ project }).build({
      name: "Helpful Assistant",
      logoUrl: "https://placehold.co/52x52/png",
      description: "Answers questions from the project's documents in a chat window.",
      appUrl: "https://assistant.example.com",
      installInstructions: "Open the app, sign in with your account and pick this project.",
      grantablePermissions: ["project.read", "document.read", "document_tag.read", "agent.read"],
      installed: withInstalledApp,
    }),
    appCatalogEntryFactory.transient({ project }).build({
      name: "Site Crawler",
      description: "Keeps a website's pages in sync with the project's documents.",
      appUrl: null,
      installInstructions:
        "Access to this app is not open yet. Ask the Bayes team to set it up for you.",
      grantablePermissions: [
        "document.read",
        "document.create",
        "document.update",
        "document_source.read",
        "document_source.create",
      ],
    }),
    appCatalogEntryFactory.transient({ project }).build({
      name: "Support Inbox",
      description: null,
      appUrl: null,
      installInstructions: null,
      grantablePermissions: [],
    }),
  ]
}

function studioState({ withApps, withInstalledApp, canInstall, ...args }: StoryArgs) {
  const { baseSeeds, project } = buildStudioData(args)
  const viewerProject = {
    ...project,
    featureFlags: args.featureFlags ?? project.featureFlags,
    permissions: canInstall
      ? [
          PROJECT_APP_INSTALLATION_READ_PERMISSION,
          PROJECT_APP_INSTALLATION_REVOKE_PERMISSION,
          PROJECT_APP_INSTALLATION_CREATE_PERMISSION,
        ]
      : [],
  }
  const entries = withApps ? buildEntries(viewerProject, withInstalledApp ?? false) : []
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.projects([viewerProject], { currentId: viewerProject.id }),
      seed.studio.appCatalog(entries),
    ),
    services: { appCatalog: buildMockAppCatalogService({ entries }) },
  }
}

/** Opens the permissions of the first app, the way someone clicks its link. */
const openFirstPermissions = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const [link] = await canvas.findAllByRole("button", { name: /permissions?$/ })
  if (link) await userEvent.click(link)
}

export const NotInstalled: Story = {
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const Installed: Story = {
  args: { withInstalledApp: true },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const EmptyCatalog: Story = {
  args: { withApps: false },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const MemberWithoutInstallRights: Story = {
  args: { canInstall: false },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const FlagOff: Story = {
  args: { featureFlags: studioStoryArgs.featureFlags },
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
}

export const PermissionsDialog: Story = {
  decorators: [buildDecorator<StoryArgs>((args) => studioState(args))],
  play: async ({ canvasElement }) => {
    await openFirstPermissions(canvasElement)
  },
}

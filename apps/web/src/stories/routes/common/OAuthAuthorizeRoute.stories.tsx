import {
  APP_GRANTABLE_PERMISSIONS,
  OAUTH_GRANTABLE_PERMISSIONS,
} from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { within } from "storybook/test"
import type { AppInstaller } from "@/common/features/app-installers/app-installers.models"
import { userFactory } from "@/common/features/me/me.factory"
import {
  oauthAuthorizationRequestFactory,
  oauthConsentPageFactory,
  oauthConsentProjectFactory,
} from "@/common/features/oauth-consent/oauth-consent.factory"
import { RouteNames } from "@/common/routes/helpers"
import { oauthAuthorizeRoute } from "@/common/routes/Router"
import { buildMockStore } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"

type StoryArgs = {
  kind: "mcp" | "app"
  verified: boolean
  withProjects: boolean
  singleWorkspace: boolean
  manyItems: boolean
  invalidRequest: boolean
  /** Who already installed the app on the first workspace. */
  installedBy: "nobody" | AppInstaller["kind"]
  /** The other workspaces are installed too: one by the person, one by a former member. */
  mixedInstallations: boolean
}

const installers: Record<AppInstaller["kind"], AppInstaller> = {
  me: { kind: "me" },
  member: { kind: "member", name: "Alex Morgan", email: "alex.morgan@example.com" },
  "former-member": { kind: "former-member" },
}

const request = oauthAuthorizationRequestFactory.build({ client_id: "helpful-assistant" })
const entry = `${RouteNames.OAUTH_AUTHORIZE}?${new URLSearchParams(
  Object.entries(request).filter((pair): pair is [string, string] => pair[1] !== undefined),
).toString()}`

const firstOrganizationId = "0b9a4c1e-6a43-4f39-9f4e-1d2f3a4b5c6d"
const projects = [
  oauthConsentProjectFactory.build({
    name: "Support",
    organizationId: firstOrganizationId,
    organizationName: "Acme",
    availablePermissions: [...OAUTH_GRANTABLE_PERMISSIONS],
  }),
  oauthConsentProjectFactory.build({
    name: "Pricing",
    organizationId: firstOrganizationId,
    organizationName: "Acme",
    availablePermissions: ["project.read"],
  }),
  oauthConsentProjectFactory.build({ name: "Product", organizationName: "Globex" }),
]

const appPermissions = ["document.read", "document.create", "document_tag.read"]
const appWorkspaces = [
  oauthConsentProjectFactory.build({
    name: "Support",
    organizationId: firstOrganizationId,
    organizationName: "Acme",
    availablePermissions: appPermissions,
  }),
  oauthConsentProjectFactory.build({
    name: "Pricing",
    organizationId: firstOrganizationId,
    organizationName: "Acme",
    availablePermissions: ["document.read"],
  }),
  oauthConsentProjectFactory.build({
    name: "Product handbook and release notes",
    organizationName: "Globex",
    availablePermissions: appPermissions,
  }),
]

const manyAppWorkspaces = [
  { organizationName: "Acme", names: ["Support", "Pricing", "Sales", "Marketing", "Finance"] },
  { organizationName: "Globex", names: ["Product", "Design", "Research", "Engineering"] },
  { organizationName: "Initech", names: ["Operations", "Legal", "Onboarding", "Partners"] },
].flatMap(({ organizationName, names }) => {
  const organizationId = faker.string.uuid()
  return names.map((name) =>
    oauthConsentProjectFactory.build({
      name,
      organizationId,
      organizationName,
      availablePermissions: [...APP_GRANTABLE_PERMISSIONS],
    }),
  )
})

function appWorkspacesFor({
  withProjects,
  singleWorkspace,
  manyItems,
  installedBy,
  mixedInstallations,
}: StoryArgs) {
  if (!withProjects) return []
  const workspaces = manyItems
    ? manyAppWorkspaces
    : singleWorkspace
      ? appWorkspaces.slice(0, 1)
      : appWorkspaces
  return workspaces.map((workspace, index) => {
    if (index === 0) {
      return {
        ...workspace,
        installedBy: installedBy === "nobody" ? null : installers[installedBy],
      }
    }
    if (!mixedInstallations) return workspace
    if (index === 1) return { ...workspace, installedBy: installers.me }
    if (index === 2) return { ...workspace, installedBy: installers["former-member"] }
    return workspace
  })
}

function buildPage(args: StoryArgs) {
  const { kind, verified } = args
  if (kind === "app") {
    return oauthConsentPageFactory.build({
      client: {
        kind: "app",
        name: "Helpful Assistant",
        redirectHost: "app.example.com",
        verified,
        description: "Keeps the workspace's documents in sync with a website.",
      },
      projects: appWorkspacesFor(args),
      grantablePermissions: args.manyItems ? [...APP_GRANTABLE_PERMISSIONS] : appPermissions,
    })
  }
  return oauthConsentPageFactory.build({
    client: verified
      ? { name: "Helpful Assistant", redirectHost: "app.example.com", verified: true }
      : { name: "Helpful Assistant", redirectHost: "127.0.0.1", verified: false },
    projects: args.withProjects ? (args.singleWorkspace ? projects.slice(0, 1) : projects) : [],
    grantablePermissions: [...OAUTH_GRANTABLE_PERMISSIONS],
  })
}

function renderRoute(args: StoryArgs) {
  const { invalidRequest } = args
  const page = buildPage(args)
  const store = buildMockStore({
    state: mergeSeeds(
      seed.me(userFactory.build({ termsAccepted: true })),
      invalidRequest
        ? seed.oauthConsentError("redirect_uri is not registered for this client")
        : seed.oauthConsentPage(page),
    ),
  })
  const router = createMemoryRouter([oauthAuthorizeRoute], { initialEntries: [entry] })
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  )
}

const meta = {
  title: "routes/common/oauth-authorize",
  parameters: { layout: "fullscreen" },
  argTypes: {
    kind: { control: "inline-radio", options: ["mcp", "app"] },
    verified: { control: "boolean" },
    withProjects: { control: "boolean" },
    singleWorkspace: { control: "boolean" },
    manyItems: { control: "boolean" },
    invalidRequest: { control: "boolean" },
    installedBy: { control: "inline-radio", options: ["nobody", "me", "member", "former-member"] },
    mixedInstallations: { control: "boolean" },
  },
  args: {
    kind: "mcp",
    verified: true,
    withProjects: true,
    singleWorkspace: false,
    manyItems: false,
    invalidRequest: false,
    installedBy: "nobody",
    mixedInstallations: false,
  },
  render: renderRoute,
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

/** An MCP client, such as an AI assistant, asks to act as the person on the projects they pick. */
export const McpConnect: Story = {}

/** An MCP client whose name the platform has not verified: the screen warns before access is granted. */
export const McpConnectUnverified: Story = {
  args: { verified: false },
}

/** A single project is picked from the start, so the permissions show. */
export const McpConnectOneProject: Story = {
  args: { singleWorkspace: true },
}

export const McpConnectNoProjects: Story = {
  args: { withProjects: false },
}

/** An app installed on one workspace chosen from the list, with the permissions of its manifest. */
export const AppInstall: Story = {
  args: { kind: "app" },
}

/** An app the platform has not registered: the screen warns before the person installs it. */
export const AppInstallUnverified: Story = {
  args: { kind: "app", verified: false },
}

export const AppInstallOneWorkspace: Story = {
  args: { kind: "app", singleWorkspace: true },
}

/** Many workspaces go in a select, and every permission an app can ask for fits in a few rows. */
export const AppInstallManyItems: Story = {
  args: { kind: "app", manyItems: true },
}

/** The person installed the app on this workspace before: approving reconnects it. */
export const AppReconnect: Story = {
  args: { kind: "app", singleWorkspace: true, installedBy: "me" },
}

/**
 * A colleague installed the app on this workspace: approving is refused, and the page says who
 * to ask and how to replace the installation on purpose.
 */
export const AppInstalledByMember: Story = {
  args: { kind: "app", singleWorkspace: true, installedBy: "member" },
}

/**
 * The installer can no longer manage the workspace's apps (they left, lost the permission, or
 * have no account): the page says what reconnecting does, and the person can reconnect the app
 * and become its installer.
 */
export const AppInstalledByFormerMember: Story = {
  args: { kind: "app", singleWorkspace: true, installedBy: "former-member" },
}

/**
 * The picker says where the app is installed already, so the person learns it before approving.
 * The first workspace is someone else's installation, so the page selects the next one.
 */
export const AppInstallSomeWorkspacesInstalled: Story = {
  args: { kind: "app", installedBy: "member", mixedInstallations: true },
}

/**
 * The safety net behind the hidden button: a submit that reaches the form anyway (Enter, a
 * script) is refused and says why.
 */
export const AppInstalledByMemberSubmitted: Story = {
  args: { kind: "app", singleWorkspace: true, installedBy: "member" },
  play: async ({ canvasElement }) => {
    const form = await within(canvasElement).findByRole("radiogroup")
    form.closest("form")?.requestSubmit()
  },
}

export const AppInstallNoWorkspaces: Story = {
  args: { kind: "app", withProjects: false },
}

export const InvalidRequest: Story = {
  args: { invalidRequest: true },
}

/** A malformed query string: the page never calls the API and never redirects. */
export const MalformedLink: Story = {
  render: () => {
    const store = buildMockStore({
      state: seed.me(userFactory.build({ termsAccepted: true })),
    })
    const router = createMemoryRouter([oauthAuthorizeRoute], {
      initialEntries: [`${RouteNames.OAUTH_AUTHORIZE}?response_type=code&client_id=x`],
    })
    return (
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    )
  },
}

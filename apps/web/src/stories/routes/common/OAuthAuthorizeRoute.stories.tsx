import type { Meta, StoryObj } from "@storybook/react-vite"
import { Provider } from "react-redux"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
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
  invalidRequest: boolean
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
]

function buildPage({ kind, verified, withProjects }: StoryArgs) {
  if (kind === "app") {
    return oauthConsentPageFactory.build({
      client: {
        kind: "app",
        name: "Helpful Assistant",
        redirectHost: "app.example.com",
        verified: true,
        description: "Keeps the workspace's documents in sync with a website.",
      },
      projects: withProjects ? appWorkspaces : [],
      grantablePermissions: appPermissions,
    })
  }
  return oauthConsentPageFactory.build({
    client: verified
      ? { name: "Helpful Assistant", redirectHost: "app.example.com", verified: true }
      : { name: "Helpful Assistant", redirectHost: "127.0.0.1", verified: false },
    projects: withProjects ? projects : [],
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
    invalidRequest: { control: "boolean" },
  },
  args: {
    kind: "mcp",
    verified: true,
    withProjects: true,
    invalidRequest: false,
  },
  render: renderRoute,
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Verified: Story = {}

export const Unverified: Story = {
  args: { verified: false },
}

export const NoProjects: Story = {
  args: { withProjects: false },
}

/** An app installed on one workspace, with the permissions of its manifest. */
export const AppInstall: Story = {
  args: { kind: "app" },
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

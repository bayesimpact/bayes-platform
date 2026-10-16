import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import { ConnectedAppsDialog } from "@/common/features/oauth-grants/components/ConnectedAppsDialog"
import {
  oauthGrantClientFactory,
  oauthGrantFactory,
  oauthGrantProjectFactory,
} from "@/common/features/oauth-grants/oauth-grants.factory"
import type { OAuthGrant } from "@/common/features/oauth-grants/oauth-grants.models"
import type { IOAuthGrantsSpi } from "@/common/features/oauth-grants/oauth-grants.spi"
import { buildDecorator, type StoryPreloadedState } from "@/stories/decorators"
import { seed } from "@/stories/seed"

const DAY = 24 * 60 * 60 * 1000

function buildMockOAuthGrantsService(
  overrides: { grants?: OAuthGrant[]; failRevoke?: boolean } = {},
): IOAuthGrantsSpi {
  return {
    getAll: async () => overrides.grants ?? [],
    deleteOne: async () => {
      if (overrides.failRevoke) throw new Error("Access could not be revoked")
    },
  }
}

const grants = [
  oauthGrantFactory.build({
    client: oauthGrantClientFactory.build({ name: "Helpful Assistant", verified: true }),
    projects: [
      oauthGrantProjectFactory.build({ name: "Product" }),
      oauthGrantProjectFactory.build({ name: "Support" }),
    ],
    permissions: ["project.read", "agent.create"],
    createdAt: new Date("2026-09-02T10:00:00Z").getTime(),
    lastUsedAt: Date.now() - 2 * DAY,
  }),
  oauthGrantFactory.build({
    client: oauthGrantClientFactory.build({
      name: "Desktop Notes",
      clientId: "4f7d2c8e-9b1a-4e55-8c1d-3a6f0b2e7d91",
      verified: false,
    }),
    projects: [oauthGrantProjectFactory.build({ name: "Pricing" })],
    permissions: ["project.read"],
    createdAt: new Date("2026-10-08T15:30:00Z").getTime(),
    lastUsedAt: null,
  }),
  oauthGrantFactory.build({
    client: oauthGrantClientFactory.build({
      name: null,
      clientId: "https://tools.example.org/mcp/client.json",
      verified: true,
    }),
    projects: [oauthGrantProjectFactory.build({ name: "Product" })],
    permissions: ["project.read"],
    createdAt: new Date("2026-07-14T08:00:00Z").getTime(),
    lastUsedAt: Date.now() - 40 * DAY,
  }),
]

function decorator(state: StoryPreloadedState, service: IOAuthGrantsSpi) {
  return buildDecorator(() => ({ state, services: { oauthGrants: service } }))
}

const meta = {
  title: "common/ConnectedAppsDialog",
  component: ConnectedAppsDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onClose: fn(),
  },
} satisfies Meta<typeof ConnectedAppsDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {
  decorators: [decorator(seed.oauthGrants(grants), buildMockOAuthGrantsService({ grants }))],
}

export const Empty: Story = {
  decorators: [decorator(seed.oauthGrants([]), buildMockOAuthGrantsService())],
}

export const Loading: Story = {
  decorators: [decorator(seed.oauthGrantsLoading(), buildMockOAuthGrantsService({ grants }))],
}

export const LoadError: Story = {
  decorators: [
    decorator(
      seed.oauthGrantsError("Connected apps could not be loaded"),
      buildMockOAuthGrantsService({ grants }),
    ),
  ],
}

/** Clicks Revoke and confirms: the confirmation stays open with the error. */
export const RevokeFails: Story = {
  decorators: [
    decorator(seed.oauthGrants(grants), buildMockOAuthGrantsService({ grants, failRevoke: true })),
  ],
  play: async ({ canvasElement }) => {
    // The dialogs render in a portal, outside the story's canvas.
    const page = within(canvasElement.ownerDocument.body)
    const [firstRevokeButton] = await page.findAllByRole("button", { name: "Revoke" })
    await userEvent.click(firstRevokeButton!)
    const confirmation = await page.findByRole("dialog", { name: "Revoke Helpful Assistant?" })
    await userEvent.click(within(confirmation).getByRole("button", { name: "Revoke" }))
    await waitFor(() => expect(within(confirmation).getByRole("alert")).toBeVisible())
  },
}

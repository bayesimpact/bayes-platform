import { DeskAgentSessionsRoutes, DeskProjectsRoutes } from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay } from "msw"
import { userEvent, within } from "storybook/test"
import { appUpdate } from "@/lib/app-update"
import { agentUrlOf } from "@/test/desk-urls"
import {
  buildNoAgentWorld,
  buildReadOnlyAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
import { termsHandlers } from "@/test/msw/handlers"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { desk } from "@/test/msw/story-api"
import { deskMeta } from "./desk-meta"

/** The Desk around its pages: the home, the agents and projects, the terms, and its failures. */
const meta = {
  title: "Desk/General",
  ...deskMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {}

export const SeveralAgents: Story = {
  parameters: desk({ world: buildSeveralAgentsWorld }),
}

/** The switcher, open, leaves out the agent the person may read but not open a session with. */
export const AgentTheyOnlyRead: Story = {
  parameters: desk({ world: buildReadOnlyAgentWorld }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: /Switch agent/ }),
    )
  },
}

/**
 * The sidebar, hidden: the pointer on the button that shows it makes it peek over the page, as in
 * the Claude app.
 */
export const SidebarClosed: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Hide the sidebar" }),
    )
  },
}

export const SeveralProjects: Story = {
  parameters: desk({ world: buildSeveralProjectsWorld }),
}

/**
 * The command center that switches agent, open: the agents of every project, by project then by
 * type, the current one marked. ⌘K (Ctrl+K outside Apple systems) opens it too.
 */
export const AgentCommandCenterOpen: Story = {
  parameters: desk({ world: buildSeveralProjectsWorld }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: /Switch agent/ }),
    )
  },
}

export const NoAgent: Story = {
  parameters: desk({ world: buildNoAgentWorld }),
}

export const TermsToAccept: Story = {
  parameters: desk({ handlers: termsHandlers }),
}

/** The sidebar's history fails to load, and loads on "Try again". */
export const HistoryFailsToLoad: Story = {
  parameters: desk({
    handlers: () => [
      mockRoute(DeskAgentSessionsRoutes.getConversations, () => apiError(503), { once: true }),
    ],
  }),
}

/** A conversation that is not in the world, nor the person's. */
export const PageNotFound: Story = {
  parameters: desk({ url: (world) => `${agentUrlOf(world)}/as/${crypto.randomUUID()}` }),
}

/**
 * A new release of the Desk is out: a banner above the page offers to reload. The story reports it
 * as a file of this release gone from the server would, which counts at once.
 */
export const NewReleaseOut: Story = {
  play: () => {
    appUpdate.reportStaleBuild()
  },
}

/** A page fails once a new release is out: only a reload brings it back, so no retry is offered. */
export const PageFailsAfterNewRelease: Story = {
  parameters: desk({
    handlers: () => [mockRoute(DeskProjectsRoutes.getAllMine, () => apiError(503))],
  }),
  play: () => {
    appUpdate.reportStaleBuild()
  },
}

export const ProjectsFailToLoad: Story = {
  parameters: desk({
    handlers: () => [mockRoute(DeskProjectsRoutes.getAllMine, () => apiError(503))],
  }),
}

export const Loading: Story = {
  parameters: desk({
    handlers: () => [
      mockRoute(DeskProjectsRoutes.getAllMine, async () => {
        await delay("infinite")
        return []
      }),
    ],
  }),
}

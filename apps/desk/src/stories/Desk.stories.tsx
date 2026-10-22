import { DeskAgentSessionsRoutes, DeskProjectsRoutes } from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay } from "msw"
import { agentUrlOf } from "@/test/desk-urls"
import {
  buildNoAgentWorld,
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

export const SeveralProjects: Story = {
  parameters: desk({ world: buildSeveralProjectsWorld }),
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

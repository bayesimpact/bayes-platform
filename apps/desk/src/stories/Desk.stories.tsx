import {
  DeskAgentSessionsRoutes,
  DeskConversationsRoutes,
  DeskProjectsRoutes,
} from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay } from "msw"
import { userEvent, within } from "storybook/test"
import { agentUrlOf, conversationUrlOf, extractionUrlsOf } from "@/test/desk-urls"
import {
  buildEmptyHistoryWorld,
  buildExtractionAgentWorld,
  buildNoAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
import { termsHandlers } from "@/test/msw/handlers"
import { apiError, mockRoute, mockStreamRoute } from "@/test/msw/mock-route"
import { desk } from "@/test/msw/story-api"
import { DeskStory } from "./DeskStory"

/**
 * The whole Desk on the mocked API, one story per state of its world: each opens a page, and the
 * person goes anywhere from there, as in the Desk itself.
 */
const meta = {
  title: "Desk",
  // Every story here is the whole Desk, with providers of its own: the main world by default.
  parameters: desk(),
  // Keyed by story: the next story starts a Desk of its own, on its own world, rather than keep
  // the router and the cache of the previous one.
  render: (_args, { id, loaded }) => (
    <DeskStory key={id} url={typeof loaded.deskUrl === "string" ? loaded.deskUrl : "/app/"} />
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {}

export const Conversation: Story = {
  parameters: desk({ url: (world) => conversationUrlOf(world) }),
}

export const FirstConversation: Story = {
  parameters: desk({ world: buildEmptyHistoryWorld }),
}

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

export const NewExtraction: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).newExtractionUrl,
  }),
}

/** The notes are still being read: the page shows the agent reading, then the result. */
export const ExtractionPending: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).runUrl("meeting-notes.md"),
  }),
}

export const ExtractionResult: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).runUrl("quarterly-report.pdf"),
  }),
}

export const ExtractionFailure: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).runUrl("scanned-manual.pdf"),
  }),
}

export const CsvSetup: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).csvSetupUrl("articles.csv"),
  }),
}

export const CsvRun: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).csvRunUrl("articles.csv"),
  }),
}

/**
 * The agent fails its reply to the message the story sends, with the server's reason, and
 * answers the retry.
 */
export const ReplyFails: Story = {
  parameters: desk({
    url: (world) => conversationUrlOf(world),
    handlers: () => [
      mockStreamRoute(
        DeskConversationsRoutes.streamReply,
        () => [{ thrownError: "The model is overloaded" }],
        { once: true },
      ),
    ],
  }),
  // A reply fails only once the person sent a message: the story sends one, in either language.
  play: async ({ canvasElement }) => {
    const composer = await within(canvasElement).findByRole(
      "textbox",
      { name: /Helpful Assistant/ },
      { timeout: 5000 },
    )
    await userEvent.type(composer, "Hello{Enter}")
  },
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

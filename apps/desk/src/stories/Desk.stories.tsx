import type { Meta, StoryObj } from "@storybook/react-vite"
import { delay, HttpResponse, http } from "msw"
import { conversationUrlOf } from "@/test/desk-urls"
import { extractionUrlsOf } from "@/test/extraction-urls"
import {
  buildEmptyHistoryWorld,
  buildExtractionAgentWorld,
  buildNoAgentWorld,
  buildSeveralAgentsWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/desk-world.factory"
import { termsHandlers } from "@/test/msw/handlers"
import type { DeskStoryParameters } from "@/test/msw/story-worker"
import { DeskStory } from "./DeskStory"

/**
 * The whole Desk on the mocked API, one story per state of its world: each opens a page, and the
 * person goes anywhere from there, as in the Desk itself.
 */
const meta = {
  title: "Desk",
  render: (_args, { loaded }) => (
    <DeskStory url={typeof loaded.deskUrl === "string" ? loaded.deskUrl : "/app/"} />
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const desk = (parameters: DeskStoryParameters) => ({ desk: parameters })

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
  parameters: desk({ handlers: termsHandlers() }),
}

export const NewExtraction: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).newExtractionUrl,
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
    url: (world) => extractionUrlsOf(world).csvRunUrl,
  }),
}

export const ProjectsFailToLoad: Story = {
  parameters: desk({
    handlers: [http.get("*/api/projects/mine", () => new HttpResponse(null, { status: 503 }))],
  }),
}

export const Loading: Story = {
  parameters: desk({
    handlers: [
      http.get("*/api/projects/mine", async () => {
        await delay("infinite")
        return HttpResponse.json({})
      }),
    ],
  }),
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import { extractionUrlsOf } from "@/test/desk-urls"
import { buildExtractionAgentWorld } from "@/test/factories/desk-world.factory"
import { desk } from "@/test/msw/story-api"
import { deskMeta } from "./desk-meta"

/** The extractions of an extraction agent: of a document, and of a CSV file. */
const meta = {
  title: "Desk/Extraction",
  ...deskMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const NewExtraction: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).newExtractionUrl,
  }),
}

/** A document's details beside the page: the story opens those of the quarterly report. */
export const DocumentDetails: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).newExtractionUrl,
  }),
  play: async ({ canvasElement }) => {
    // The page's own list: the sidebar's history names the report too.
    const page = await within(canvasElement).findByRole("main", {}, { timeout: 5000 })
    const details = await within(page).findByRole(
      "button",
      { name: /quarterly-report\.pdf/, expanded: false },
      { timeout: 5000 },
    )
    await userEvent.click(details)
  },
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

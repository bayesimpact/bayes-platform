import { DeskAgentSessionsRoutes, DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import { extractionUrlsOf } from "@/test/desk-urls"
import {
  buildCsvFilesWithoutRowsWorld,
  buildCsvRunInProgressWorld,
  buildExtractionAgentWorld,
  type DeskWorld,
} from "@/test/factories/desk-world.factory"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { desk } from "@/test/msw/story-api"
import { deskMeta } from "./desk-meta"

/** The extractions of an extraction agent: of a document, and of a CSV file. */
const meta = {
  title: "Desk/Extraction",
  ...deskMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * Answers the CSV runs of a world as they are: the mocked API does a few more rows at each poll,
 * and would end a run within seconds.
 */
const csvRunsAsTheyAreHandlers = (world: DeskWorld) => [
  mockRoute(
    DeskAgentSessionsRoutes.getCsvExtractionRuns,
    ({ params }) => world.csvExtractionRuns[params.agentId] ?? [],
  ),
  mockRoute(
    DeskCsvExtractionsRoutes.getOne,
    ({ params }) =>
      (world.csvExtractionRuns[params.agentId] ?? []).find(
        (run) => run.id === params.agentCsvExtractionRunId,
      ) ?? apiError(404),
  ),
]

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

/** A CSV file with a header line and no data row: its columns show, with no first values. */
export const CsvSetupOfHeaderOnlyFile: Story = {
  parameters: desk({
    world: buildCsvFilesWithoutRowsWorld,
    url: (world) => extractionUrlsOf(world).csvSetupUrl("header-only.csv"),
  }),
}

/** A CSV file with no header line has no column to set up: its page says so, and leads to another file. */
export const CsvSetupOfFileWithoutColumns: Story = {
  parameters: desk({
    world: buildCsvFilesWithoutRowsWorld,
    url: (world) => extractionUrlsOf(world).csvSetupUrl("empty.csv"),
  }),
}

export const CsvRun: Story = {
  parameters: desk({
    world: buildExtractionAgentWorld,
    url: (world) => extractionUrlsOf(world).csvRunUrl("articles.csv"),
  }),
}

/**
 * The run of a CSV file still goes on, and the person clicked "Stop": the Desk asks before it
 * stops the run. The story's run stays where it is until the person confirms.
 */
export const CsvRunStopConfirmation: Story = {
  parameters: desk({
    world: buildCsvRunInProgressWorld,
    handlers: csvRunsAsTheyAreHandlers,
    url: (world) => extractionUrlsOf(world).csvRunUrl("articles.csv"),
  }),
  // The button's name in either language of the toolbar.
  play: async ({ canvasElement }) => {
    const stop = await within(canvasElement).findByRole(
      "button",
      { name: /^(Stop|Arrêter)$/ },
      { timeout: 5000 },
    )
    await userEvent.click(stop)
  },
}

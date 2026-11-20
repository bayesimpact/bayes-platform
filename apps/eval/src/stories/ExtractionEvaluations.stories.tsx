import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import {
  evaluationsUrlOf,
  extractionCompareUrlOf,
  extractionDatasetUrlOf,
  extractionRunOfDatasetUrlOf,
  extractionRunUrlOf,
} from "@/test/eval-urls"
import {
  buildExtractionWorld,
  buildSeveralProjectsWorld,
} from "@/test/factories/eval-world.factory"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The evaluations of an extraction agent, for who evaluates its project: its datasets and runs. */
const meta = {
  title: "Evaluation/Extraction evaluations",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The datasets of the agent's project: one built from a file, and one that waits for its file. */
export const DatasetList: Story = {
  parameters: evaluation({ world: buildExtractionWorld, url: evaluationsUrlOf }),
}

/** A project with no dataset yet: the page leads to the first one. */
export const NoDataset: Story = {
  parameters: evaluation({
    world: buildSeveralProjectsWorld,
    url: (world) => evaluationsUrlOf(world, "Document Reader"),
  }),
}

/** The dialog that names a new dataset, which the sidebar's New dataset opens from any page. */
export const NewDataset: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => `${evaluationsUrlOf(world)}?create=true`,
  }),
}

/** A dataset that waits for its file: the project's CSV files, and the way to upload one. */
export const ChooseFile: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionDatasetUrlOf(world, "Product feedback"),
  }),
}

/** A file is chosen: its first rows, then the name and the role of each of its columns. */
export const ChooseColumns: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionDatasetUrlOf(world, "Product feedback"),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Use the file support-messages.csv" }),
    )
  },
}

/** A dataset built from a file: all its records, with the columns it keeps. */
export const Dataset: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionDatasetUrlOf(world, "Support messages"),
  }),
}

/** A dataset of 120 records: the API pages them, 50 at a time, sorts them and searches them. */
export const LargeDataset: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionDatasetUrlOf(world, "All messages"),
  }),
}

/** The runs of a dataset: one under way, two over and one that failed. */
export const DatasetRuns: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => `${extractionDatasetUrlOf(world, "Support messages")}?tab=runs`,
  }),
}

/** The side panel of a dataset's page that starts an evaluation: the agent's version, the fields to compare, how many records. */
export const RunEvaluation: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => `${extractionDatasetUrlOf(world, "Support messages")}?run=true`,
  }),
}

/** A run that is over: its figures, then each record with the fields the agent returned. */
export const CompletedRun: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionRunUrlOf(world, "completed"),
  }),
}

/** A run of 120 records: its results come a page at a time, as its dataset's records do. */
export const LargeRun: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionRunOfDatasetUrlOf(world, "All messages"),
  }),
}

/** A run under way, which a person can cancel: some records wait for their values. */
export const RunUnderWay: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionRunUrlOf(world, "running"),
  }),
}

/** A run that failed before it asked a record, which a person can retry. */
export const FailedRun: Story = {
  parameters: evaluation({
    world: buildExtractionWorld,
    url: (world) => extractionRunUrlOf(world, "failed"),
  }),
}

/** The two runs that are over, side by side: their figures, then each record in each run. */
export const CompareRuns: Story = {
  parameters: evaluation({ world: buildExtractionWorld, url: extractionCompareUrlOf }),
}

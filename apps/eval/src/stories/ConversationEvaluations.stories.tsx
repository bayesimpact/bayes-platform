import type { Meta, StoryObj } from "@storybook/react-vite"
import { fireEvent, userEvent, within } from "storybook/test"
import { conversationDatasetUrlOf, evaluationsUrlOf } from "@/test/eval-urls"
import { buildSeveralProjectsWorld } from "@/test/factories/eval-world.factory"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The evaluations of a conversation agent, for who evaluates its project: its datasets. */
const meta = {
  title: "Evaluation/Conversation evaluations",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The datasets of the agent's project: one with records, and an empty one. */
export const DatasetList: Story = {
  parameters: evaluation({ url: evaluationsUrlOf }),
}

/** A project with no dataset yet: the page leads to the first one. */
export const NoDataset: Story = {
  parameters: evaluation({
    world: buildSeveralProjectsWorld,
    url: (world) => evaluationsUrlOf(world, "Writing Helper"),
  }),
}

/** The dialog that names a new dataset. */
export const NewDataset: Story = {
  parameters: evaluation({ url: evaluationsUrlOf }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "New dataset" }))
  },
}

/** A dataset: the first page of its records, each with what to change it. */
export const Dataset: Story = {
  parameters: evaluation({ url: (world) => conversationDatasetUrlOf(world, "Pricing questions") }),
}

/** The second page of a dataset's records. */
export const DatasetSecondPage: Story = {
  parameters: evaluation({
    url: (world) => `${conversationDatasetUrlOf(world, "Pricing questions")}?page=1`,
  }),
}

/** A dataset with no record yet. */
export const EmptyDataset: Story = {
  parameters: evaluation({
    url: (world) => conversationDatasetUrlOf(world, "Onboarding questions"),
  }),
}

/** The dialog that adds one record. */
export const AddRecord: Story = {
  parameters: evaluation({
    url: (world) => conversationDatasetUrlOf(world, "Onboarding questions"),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "Add a record" }))
  },
}

/** Pasted lines, one of them with no expected output: the dialog names it and adds nothing. */
export const AddSeveralRecords: Story = {
  parameters: evaluation({
    url: (world) => conversationDatasetUrlOf(world, "Onboarding questions"),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "Bulk add" }))
    const body = within(canvasElement.ownerDocument.body)
    // Pasted at once, as a person would: one change of the field, not a key at a time.
    fireEvent.change(await body.findByRole("textbox", { name: "Records" }), {
      target: {
        value: "How do I invite a colleague?, From Settings, then Team.\nWhere is the mobile app?",
      },
    })
  },
}

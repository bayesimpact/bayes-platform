import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, userEvent, within } from "storybook/test"
import { SaveAsTestCaseDialog } from "@/studio/features/test-cases/components/SaveAsTestCaseDialog"
import {
  buildMockTestCaseCallbacks,
  mockCritique,
  mockDatasets,
  mockFirstTurnTestCaseSource,
  mockLongAnswerTestCaseSource,
  mockPraise,
  mockTestCaseSource,
} from "./fixtures"

const meta = {
  title: "test-cases/SaveAsTestCaseDialog",
  component: SaveAsTestCaseDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onOpenChange: fn(),
    source: mockTestCaseSource,
    datasets: mockDatasets,
    canCreateDataset: true,
    ...buildMockTestCaseCallbacks(),
  },
} satisfies Meta<typeof SaveAsTestCaseDialog>

export default meta
type Story = StoryObj<typeof meta>

// The dialog renders in a portal, outside the story's canvas.
const findDialog = async (canvasElement: HTMLElement) =>
  within(await within(canvasElement.ownerDocument.body).findByRole("dialog"))

const describeGoodAnswer = async (canvasElement: HTMLElement) => {
  const dialog = await findDialog(canvasElement)
  await userEvent.click(dialog.getByLabelText("What is good about this answer?"))
  await userEvent.paste(mockPraise)
}

const chooseBadAnswer = async (canvasElement: HTMLElement) => {
  const dialog = await findDialog(canvasElement)
  await userEvent.click(dialog.getByRole("radio", { name: /Bad answer/ }))
  await userEvent.click(dialog.getByLabelText("What is wrong with this answer?"))
  await userEvent.paste(mockCritique)
}

const goToReview = async (canvasElement: HTMLElement) => {
  const dialog = await findDialog(canvasElement)
  await userEvent.click(dialog.getByRole("button", { name: "Next" }))
  await dialog.findByLabelText("Expected answer", {}, { timeout: 3000 })
}

/** A good answer from the playground: it becomes the reference, with an optional comment. */
export const GoodAnswer: Story = {}

/** A bad answer: the user says what is wrong before anything is drafted. */
export const BadAnswer: Story = {
  play: async ({ canvasElement }) => {
    await chooseBadAnswer(canvasElement)
  },
}

/** Started from a report on the Feedback page: a bad answer, with the report as what is wrong. */
export const FromFeedbackReport: Story = {
  args: { source: { ...mockTestCaseSource, feedback: mockCritique } },
}

/** A long answer, reported as bad: the preview scrolls and the fields stay below it. */
export const LongAnswer: Story = {
  args: { source: { ...mockLongAnswerTestCaseSource, feedback: mockCritique } },
}

/** The project has no dataset yet: the record goes to a new one, named here. */
export const NoDatasetYet: Story = {
  args: { datasets: [] },
}

/** Without the right to create datasets, the picker offers the existing ones only. */
export const CannotCreateDataset: Story = {
  args: { canCreateDataset: false },
}

/** The review of a good answer: the input is a standalone question drafted from the conversation. */
export const ReviewGoodAnswer: Story = {
  play: async ({ canvasElement }) => {
    await describeGoodAnswer(canvasElement)
    await goToReview(canvasElement)
  },
}

/** The review of a bad answer: the expected answer is drafted from what is wrong. */
export const ReviewBadAnswer: Story = {
  play: async ({ canvasElement }) => {
    await chooseBadAnswer(canvasElement)
    await goToReview(canvasElement)
  },
}

/** The input after Anonymize: the name, email and date are replaced. */
export const Anonymized: Story = {
  play: async ({ canvasElement }) => {
    await describeGoodAnswer(canvasElement)
    await goToReview(canvasElement)
    const dialog = await findDialog(canvasElement)
    await userEvent.click(dialog.getByRole("button", { name: "Anonymize" }))
    await dialog.findByText("Anonymized", {}, { timeout: 3000 })
  },
}

/** An answer to the first message, saved without a comment: the input is that message as sent. */
export const FirstTurnAnswer: Story = {
  args: {
    source: mockFirstTurnTestCaseSource,
    ...buildMockTestCaseCallbacks({ agentMessageId: mockFirstTurnTestCaseSource.agentMessageId }),
  },
  play: async ({ canvasElement }) => {
    await goToReview(canvasElement)
  },
}

/** The LLM does not answer: the user can go back or try again. */
export const DraftFails: Story = {
  args: buildMockTestCaseCallbacks({ failDrafts: true }),
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement)
    await userEvent.click(dialog.getByRole("button", { name: "Next" }))
    await dialog.findByText("The test case could not be drafted", {}, { timeout: 3000 })
  },
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"
import { campaignEditorUrlOf, campaignsUrlOf } from "@/test/eval-urls"
import { buildNoCampaignWorld, type EvalWorld } from "@/test/factories/eval-world.factory"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The review campaigns of an agent, for the owners and admins of its project. */
const meta = {
  title: "Evaluation/Review campaigns",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The URL of a step of the draft's setup. */
const draftStepUrlOf = (world: EvalWorld, step: "session" | "final" | "reviewers" | "activate") =>
  `${campaignEditorUrlOf(world, "Onboarding answers")}?step=${step}`

/** The campaigns of the agent: a draft, an active one and a closed one. */
export const CampaignList: Story = {
  parameters: evaluation({ url: campaignsUrlOf }),
}

export const NoCampaign: Story = {
  parameters: evaluation({ world: buildNoCampaignWorld, url: campaignsUrlOf }),
}

/** The first step of a new campaign: its name. The next step creates it as a draft. */
export const NewCampaign: Story = {
  parameters: evaluation({ url: (world) => `${campaignsUrlOf(world)}/new` }),
}

/** A draft opens on the first step of its setup, which it can leave and come back to. */
export const DraftCampaign: Story = {
  parameters: evaluation({ url: (world) => campaignEditorUrlOf(world, "Onboarding answers") }),
}

/** Step 2 of a draft's setup: what a tester answers after each session. */
export const SetupSessionQuestions: Story = {
  parameters: evaluation({ url: (world) => draftStepUrlOf(world, "session") }),
}

/** Removing a question with text asks for a confirmation first. */
export const RemoveQuestion: Story = {
  parameters: evaluation({ url: (world) => draftStepUrlOf(world, "session") }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "Remove question 1" }))
  },
}

/** A change not saved, then a link to another page: the setup asks before it is lost. */
export const LeaveWithUnsavedChanges: Story = {
  parameters: evaluation({ url: (world) => draftStepUrlOf(world, "session") }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole("textbox", { name: "Question 1" }), " Really?")
    await userEvent.click(canvas.getByRole("link", { name: "Spring review" }))
  },
}

/** Step 3: what a tester answers once, at the end. */
export const SetupFinalQuestions: Story = {
  parameters: evaluation({ url: (world) => draftStepUrlOf(world, "final") }),
}

/** Step 4: what a reviewer answers for each session. */
export const SetupReviewerQuestions: Story = {
  parameters: evaluation({ url: (world) => draftStepUrlOf(world, "reviewers") }),
}

/** A step of questions with the preview panel open: the forms its testers and reviewers will fill. */
export const CampaignPreview: Story = {
  parameters: evaluation({ url: (world) => `${draftStepUrlOf(world, "session")}&preview=true` }),
}

/** Step 5: what the campaign will ask, then its activation. */
export const SetupActivate: Story = {
  parameters: evaluation({ url: (world) => draftStepUrlOf(world, "activate") }),
}

/** Step 6, once the campaign is active: the invitations of its testers and reviewers. */
export const SetupInvite: Story = {
  parameters: evaluation({
    url: (world) => `${campaignEditorUrlOf(world, "Support assistant pilot")}?step=invite`,
  }),
}

/** An active campaign: its participants, the invitation form and the pending invitations. */
export const ActiveCampaign: Story = {
  parameters: evaluation({ url: (world) => campaignEditorUrlOf(world, "Support assistant pilot") }),
}

/** An active campaign on a phone: the way back keeps its arrow, the actions go in the bar's menu. */
export const ActiveCampaignOnPhone: Story = {
  parameters: evaluation({ url: (world) => campaignEditorUrlOf(world, "Support assistant pilot") }),
  globals: { viewport: { value: "iphone14", isRotated: false } },
}

/** An active campaign's setup, which no longer changes. */
export const LockedSetup: Story = {
  parameters: evaluation({
    url: (world) => `${campaignEditorUrlOf(world, "Support assistant pilot")}?tab=setup`,
  }),
}

/** A closed campaign opens on its summary. */
export const ClosedCampaign: Story = {
  parameters: evaluation({ url: (world) => campaignEditorUrlOf(world, "Spring review") }),
}

export const CampaignReport: Story = {
  parameters: evaluation({
    url: (world) => `${campaignEditorUrlOf(world, "Support assistant pilot")}/report`,
  }),
}

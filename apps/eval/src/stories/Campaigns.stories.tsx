import type { Meta, StoryObj } from "@storybook/react-vite"
import { campaignEditorUrlOf, campaignsUrlOf } from "@/test/eval-urls"
import { buildNoCampaignWorld } from "@/test/factories/eval-world.factory"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** The review campaigns of an agent, for the owners and admins of its project. */
const meta = {
  title: "Evaluation/Review campaigns",
  ...evalMeta,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The campaigns of the agent: a draft, an active one and a closed one. */
export const CampaignList: Story = {
  parameters: evaluation({ url: campaignsUrlOf }),
}

export const NoCampaign: Story = {
  parameters: evaluation({ world: buildNoCampaignWorld, url: campaignsUrlOf }),
}

/** A new campaign, with its default questions. */
export const NewCampaign: Story = {
  parameters: evaluation({ url: (world) => `${campaignsUrlOf(world)}/new` }),
}

/** A draft: its setup can change, and it can be activated or deleted. */
export const DraftCampaign: Story = {
  parameters: evaluation({ url: (world) => campaignEditorUrlOf(world, "Onboarding answers") }),
}

/** A draft with the preview panel open: the forms its testers and reviewers will fill. */
export const CampaignPreview: Story = {
  parameters: evaluation({
    url: (world) => `${campaignEditorUrlOf(world, "Onboarding answers")}?preview=true`,
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

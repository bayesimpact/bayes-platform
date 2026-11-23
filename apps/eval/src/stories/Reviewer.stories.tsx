import type { Meta, StoryObj } from "@storybook/react-vite"
import { campaignUrlOf, reviewSessionUrlOf } from "@/test/eval-urls"
import { buildParticipantWorld } from "@/test/factories/eval-world.factory"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

/** A review campaign for one of its reviewers, who holds no role on the project. */
const meta = {
  title: "Evaluation/Reviewer",
  ...evalMeta,
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => `${campaignUrlOf(world, "Pricing questions")}/review`,
  }),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The sessions to review: one to do, one reviewed, one with no message. */
export const Sessions: Story = {}

/** A session before the reviewer's own review: the tester's opinion stays hidden. */
export const BlindSession: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => reviewSessionUrlOf(world, "Pricing questions", 0),
  }),
}

/** A session the reviewer reviewed: the tester's feedback, the form and the other reviews. */
export const ReviewedSession: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => reviewSessionUrlOf(world, "Pricing questions", 1),
  }),
}

/** A closed campaign: the sessions and the reviews show, and take no change. */
export const ClosedCampaign: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => reviewSessionUrlOf(world, "Spring review", 0),
  }),
}

export const Report: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => `${campaignUrlOf(world, "Pricing questions")}/review/report`,
  }),
}

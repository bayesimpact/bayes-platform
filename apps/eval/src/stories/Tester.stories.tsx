import type { Meta, StoryObj } from "@storybook/react-vite"
import { campaignUrlOf, testerSessionUrlOf } from "@/test/eval-urls"
import { buildParticipantWorld, type EvalWorld } from "@/test/factories/eval-world.factory"
import { evaluation } from "@/test/msw/story-api"
import { evalMeta } from "./eval-meta"

const testUrlOf = (world: EvalWorld) => `${campaignUrlOf(world, "Support assistant pilot")}/test`

/** A participant who started no session yet. */
function buildNoSessionWorld(): EvalWorld {
  return { ...buildParticipantWorld(), testerSessions: {} }
}

/** A review campaign for one of its testers, who holds no role on the project. */
const meta = {
  title: "Evaluation/Tester",
  ...evalMeta,
  parameters: evaluation({ world: buildParticipantWorld, url: testUrlOf }),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The campaign: the agent to test, the tester's sessions and the final survey. */
export const Campaign: Story = {}

export const NoSession: Story = {
  parameters: evaluation({ world: buildNoSessionWorld, url: testUrlOf }),
}

/** A session with the agent: the conversation, and the way to end it with feedback. */
export const Session: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => testerSessionUrlOf(world, "Support assistant pilot", 0),
  }),
}

/** A session whose feedback is given: it stays readable. */
export const RatedSession: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => testerSessionUrlOf(world, "Support assistant pilot", 1),
  }),
}

/** The survey a tester fills when they finish taking part. */
export const FinalSurvey: Story = {
  parameters: evaluation({
    world: buildParticipantWorld,
    url: (world) => `${testUrlOf(world)}/survey`,
  }),
}

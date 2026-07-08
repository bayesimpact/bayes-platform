import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { withRouter } from "storybook-addon-remix-react-router"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { CampaignLanding } from "@/tester/features/review-campaigns/components/CampaignLanding"
import { mockProject } from "../fixtures"
import { mockSessions, mockTesterContext } from "./fixtures"

const meta = {
  title: "review-campaigns/tester/CampaignLanding",
  component: CampaignLanding,
  parameters: { layout: "fullscreen" },
  args: {
    context: mockTesterContext,
    onOpenFeedback: fn(),
    onResumeSession: fn(),
    onFinishParticipating: fn(),
    onEditSurvey: fn(),
  },
  decorators: [
    withRouter,
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.currentReviewCampaignId(mockTesterContext.id),
        seed.tester.context(mockTesterContext),
      ),
    }),
  ],
} satisfies Meta<typeof CampaignLanding>

export default meta
type Story = StoryObj<typeof meta>

export const Fresh: Story = {
  args: {
    sessions: [],
    participationFinished: false,
  },
}

export const WithPastSessions: Story = {
  args: {
    sessions: mockSessions,
    participationFinished: false,
  },
}

export const ParticipationFinished: Story = {
  args: {
    sessions: mockSessions,
    participationFinished: true,
  },
}

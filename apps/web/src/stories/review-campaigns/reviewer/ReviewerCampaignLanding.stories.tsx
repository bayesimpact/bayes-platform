import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { CampaignSessionList } from "@/reviewer/features/review-campaigns/components/CampaignSessionList"
import { withRedux } from "@/stories/decorators"
import { ads, mergeSeeds, seed } from "@/stories/seed"
import { mockProject } from "../fixtures"
import { mockCampaignContext, mockReviewerSessions } from "./fixtures"

const reviewerSessionsSeed = (sessions: typeof mockReviewerSessions) => ({
  reviewCampaignsReviewer: { sessions: ads.fulfilled(sessions) },
})

const meta = {
  title: "review-campaigns/reviewer/ReviewerCampaignLanding",
  component: CampaignSessionList,
  parameters: { layout: "fullscreen" },
  decorators: [withRouter],
} satisfies Meta<typeof CampaignSessionList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockCampaignContext),
        reviewerSessionsSeed([]),
      ),
    }),
  ],
}

export const WithMixedSessions: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockCampaignContext),
        reviewerSessionsSeed(mockReviewerSessions),
      ),
    }),
  ],
}

export const SingleSession: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockCampaignContext),
        reviewerSessionsSeed([mockReviewerSessions[0]!]),
      ),
    }),
  ],
}

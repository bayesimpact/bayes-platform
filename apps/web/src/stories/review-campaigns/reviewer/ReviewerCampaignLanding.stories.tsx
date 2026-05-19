import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { withRouter } from "storybook-addon-remix-react-router"
import { ReviewerCampaignLanding } from "@/reviewer/features/review-campaigns/components/ReviewerCampaignPage"
import { withRedux } from "@/stories/decorators"
import { mockCampaignContext, mockReviewerSessions } from "./fixtures"

const meta = {
  title: "review-campaigns/reviewer/ReviewerCampaignLanding",
  component: ReviewerCampaignLanding,
  parameters: { layout: "fullscreen" },
  args: {
    context: mockCampaignContext,
    onOpenSession: fn(),
  },
  decorators: [withRouter],
} satisfies Meta<typeof ReviewerCampaignLanding>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { sessions: [], onOpenReport: fn(), context: mockCampaignContext, onOpenSession: fn() },
  decorators: [withRedux()],
}

export const WithMixedSessions: Story = {
  args: {
    sessions: mockReviewerSessions,
    onOpenReport: fn(),
    context: mockCampaignContext,
    onOpenSession: fn(),
  },
}

export const SingleSession: Story = {
  args: {
    sessions: [mockReviewerSessions[0]!],
    onOpenReport: fn(),
    context: mockCampaignContext,
    onOpenSession: fn(),
  },
}

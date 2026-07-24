import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ReviewerSessionReview } from "@/reviewer/features/review-campaigns/components/ReviewerSessionReview"
import {
  mockBlindFillFormSession,
  mockBlindSession,
  mockBlindSessionWithOtherReviewers,
  mockFullFillFormSession,
  mockFullFillFormSessionAbandoned,
  mockFullSession,
  mockFullSessionNoTesterFeedback,
  mockFullSessionWithOtherReviewers,
} from "./fixtures"

const meta = {
  title: "review-campaigns/reviewer/ReviewerSessionReview",
  component: ReviewerSessionReview,
  parameters: { layout: "padded" },
  args: {
    onSubmitReview: fn(),
    onUpdateReview: fn(),
  },
} satisfies Meta<typeof ReviewerSessionReview>

export default meta
type Story = StoryObj<typeof meta>

export const BlindFirstVisit: Story = {
  args: { session: mockBlindSession },
}

export const BlindWithOtherReviewers: Story = {
  args: { session: mockBlindSessionWithOtherReviewers },
}

export const PostSubmitAlone: Story = {
  args: { session: mockFullSession },
}

export const PostSubmitWithOtherReviewers: Story = {
  args: { session: mockFullSessionWithOtherReviewers },
}

export const PostSubmitNoTesterFeedback: Story = {
  args: { session: mockFullSessionNoTesterFeedback },
}

export const BlindFillFormSession: Story = {
  args: { session: mockBlindFillFormSession },
}

export const PostSubmitFillFormSession: Story = {
  args: { session: mockFullFillFormSession },
}

export const PostSubmitFillFormSessionAbandoned: Story = {
  args: { session: mockFullFillFormSessionAbandoned },
}

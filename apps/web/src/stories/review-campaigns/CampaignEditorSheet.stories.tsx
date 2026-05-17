import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { CampaignEditorSheet } from "@/studio/features/review-campaigns/components/CampaignEditorSheet"
import { withRedux } from "../decorators"
import { mergeSeeds, seed } from "../seed"
import {
  mockActiveCampaign,
  mockAgents,
  mockDraftCampaign,
  mockMemberships,
  mockProject,
} from "./fixtures"
import { buildMockReviewCampaignsService } from "./mock-service"

const meta = {
  title: "review-campaigns/CampaignEditorSheet",
  component: CampaignEditorSheet,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    agents: mockAgents,
    onClose: fn(),
  },
} satisfies Meta<typeof CampaignEditorSheet>

export default meta
type Story = StoryObj<typeof meta>

export const CreateOpen: Story = {
  args: {
    mode: "create",
  },
  decorators: [
    withRedux({
      state: seed.currentProject(mockProject),
      services: { reviewCampaigns: buildMockReviewCampaignsService() },
    }),
  ],
}

export const EditDraft: Story = {
  args: {
    mode: "edit",
    reviewCampaignId: mockDraftCampaign.id,
  },
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.studio.selectedReviewCampaignDetail({
          ...mockDraftCampaign,
          memberships: [],
          aggregates: null,
        }),
      ),
      services: { reviewCampaigns: buildMockReviewCampaignsService() },
    }),
  ],
}

export const EditActive: Story = {
  args: {
    mode: "edit",
    reviewCampaignId: mockActiveCampaign.id,
  },
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.studio.selectedReviewCampaignDetail({
          ...mockActiveCampaign,
          memberships: mockMemberships,
          aggregates: null,
        }),
      ),
      services: { reviewCampaigns: buildMockReviewCampaignsService() },
    }),
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import type { Agent } from "@/common/features/agents/agents.models"
import { CampaignListPage } from "@/studio/features/review-campaigns/components/CampaignListPage"
import { withRedux } from "../decorators/with-redux"
import { mergeSeeds, seed } from "../seed"
import {
  mockActiveCampaign,
  mockAgents,
  mockClosedCampaign,
  mockDraftCampaign,
  mockProject,
} from "./fixtures"
import { buildMockReviewCampaignsService } from "./mock-service"

const meta = {
  title: "review-campaigns/CampaignListPage",
  component: CampaignListPage,
  parameters: { layout: "fullscreen" },
  decorators: [withRouter],
} satisfies Meta<typeof CampaignListPage>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.agents([]),
        seed.studio.reviewCampaigns([]),
      ),
      services: {
        reviewCampaigns: buildMockReviewCampaignsService({ campaigns: [] }),
      },
    }),
  ],
}

export const WithCampaigns: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.agents(mockAgents as Agent[]),
        seed.studio.reviewCampaigns([mockDraftCampaign, mockActiveCampaign, mockClosedCampaign]),
      ),
      services: {
        reviewCampaigns: buildMockReviewCampaignsService({
          campaigns: [mockDraftCampaign, mockActiveCampaign, mockClosedCampaign],
        }),
      },
    }),
  ],
}

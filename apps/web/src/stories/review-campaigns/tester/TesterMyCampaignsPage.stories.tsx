import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { TesterMyCampaignsPage } from "@/tester/features/review-campaigns/components/TesterMyCampaignsPage"
import { withRedux } from "../../decorators/with-redux"
import { mergeSeeds, seed } from "../../seed"
import { mockProject } from "../fixtures"
import { mockMyCampaigns } from "./fixtures"
import { buildMockTesterService } from "./mock-service"

const meta = {
  title: "review-campaigns/tester/pages/TesterMyCampaignsPage",
  component: TesterMyCampaignsPage,
  parameters: { layout: "fullscreen" },
  decorators: [withRouter],
} satisfies Meta<typeof TesterMyCampaignsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(mockProject), seed.tester.myCampaigns([])),
      services: {
        reviewCampaignsTester: buildMockTesterService({ myCampaigns: [] }),
      },
    }),
  ],
}

export const WithCampaigns: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(mockProject), seed.tester.myCampaigns(mockMyCampaigns)),
      services: {
        reviewCampaignsTester: buildMockTesterService({ myCampaigns: mockMyCampaigns }),
      },
    }),
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { CampaignList } from "@/tester/features/review-campaigns/components/CampaignList"
import { mockProject } from "../fixtures"
import { mockMyCampaigns } from "./fixtures"

const meta = {
  title: "review-campaigns/tester/MyCampaigns",
  component: CampaignList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
} satisfies Meta<typeof CampaignList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(mockProject), seed.tester.myCampaigns([])),
    }),
  ],
}

export const WithMix: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(mockProject), seed.tester.myCampaigns(mockMyCampaigns)),
    }),
  ],
}

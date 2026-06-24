import type { Meta, StoryObj } from "@storybook/react-vite"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { TesterRoutes } from "@/tester/routes/helpers"
import { TesterEndOfPhaseSurveyRoute } from "@/tester/routes/TesterEndOfPhaseSurveyRoute"
import { mockProject } from "../fixtures"
import { mockSurvey, mockTesterContext } from "./fixtures"
import { buildMockTesterService } from "./mock-service"

const pathParams = {
  organizationId: mockProject.organizationId,
  projectId: mockProject.id,
  reviewCampaignId: mockTesterContext.id,
}

const meta = {
  title: "review-campaigns/tester/pages/TesterEndOfPhaseSurveyRoute",
  component: TesterEndOfPhaseSurveyRoute,
  parameters: {
    layout: "fullscreen",
    reactRouter: reactRouterParameters({
      location: { pathParams },
      routing: { path: TesterRoutes.survey.build(pathParams) },
    }),
  },
  decorators: [withRouter],
} satisfies Meta<typeof TesterEndOfPhaseSurveyRoute>

export default meta
type Story = StoryObj<typeof meta>

export const FirstTime: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.currentReviewCampaignId(mockTesterContext.id),
        seed.tester.context(mockTesterContext),
        seed.tester.campaignSurvey(null),
      ),
      services: { reviewCampaignsTester: buildMockTesterService() },
    }),
  ],
}

const editingSurvey = {
  ...mockSurvey,
  comment: "Overall good, faster responses would help.",
  answers: [{ questionId: "eop-1", value: 4 }],
}

export const Editing: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.currentReviewCampaignId(mockTesterContext.id),
        seed.tester.context(mockTesterContext),
        seed.tester.campaignSurvey(editingSurvey),
      ),
      services: {
        reviewCampaignsTester: buildMockTesterService({ myTesterSurvey: editingSurvey }),
      },
    }),
  ],
}

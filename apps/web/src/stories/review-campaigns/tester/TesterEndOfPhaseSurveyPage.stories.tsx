import type { Meta, StoryObj } from "@storybook/react-vite"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import { TesterEndOfPhaseSurveyPage } from "@/tester/features/review-campaigns/components/TesterEndOfPhaseSurveyPage"
import { TesterRouteNames } from "@/tester/routes/helpers"
import { withRedux } from "../../decorators"
import { mergeSeeds, seed } from "../../seed"
import { mockProject } from "../fixtures"
import { mockSurvey, mockTesterContext } from "./fixtures"
import { buildMockTesterService } from "./mock-service"

const pathParams = {
  organizationId: mockProject.organizationId,
  projectId: mockProject.id,
  reviewCampaignId: mockTesterContext.id,
}

const meta = {
  title: "review-campaigns/tester/pages/TesterEndOfPhaseSurveyPage",
  component: TesterEndOfPhaseSurveyPage,
  parameters: {
    layout: "fullscreen",
    reactRouter: reactRouterParameters({
      location: { pathParams },
      routing: { path: TesterRouteNames.SURVEY },
    }),
  },
  decorators: [withRouter],
} satisfies Meta<typeof TesterEndOfPhaseSurveyPage>

export default meta
type Story = StoryObj<typeof meta>

export const FirstTime: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(mockProject), seed.tester.context(mockTesterContext)),
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
        seed.tester.context(mockTesterContext),
        seed.tester.surveyByCampaignId({ [mockTesterContext.id]: editingSurvey }),
      ),
      services: {
        reviewCampaignsTester: buildMockTesterService({ myTesterSurvey: editingSurvey }),
      },
    }),
  ],
}

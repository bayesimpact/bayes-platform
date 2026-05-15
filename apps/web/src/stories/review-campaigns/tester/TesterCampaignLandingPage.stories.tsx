import type { Meta, StoryObj } from "@storybook/react-vite"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import { TesterCampaignLandingPage } from "@/tester/features/review-campaigns/components/TesterCampaignLandingPage"
import { TesterRouteNames } from "@/tester/routes/helpers"
import { withRedux } from "../../decorators/with-redux"
import { mergeSeeds, seed } from "../../seed"
import { mockProject } from "../fixtures"
import { mockSessionSummaries, mockSessions, mockSurvey, mockTesterContext } from "./fixtures"
import { buildMockTesterService } from "./mock-service"

const pathParams = {
  organizationId: mockProject.organizationId,
  projectId: mockProject.id,
  reviewCampaignId: mockTesterContext.id,
}

const meta = {
  title: "review-campaigns/tester/pages/TesterCampaignLandingPage",
  component: TesterCampaignLandingPage,
  parameters: {
    layout: "fullscreen",
    reactRouter: reactRouterParameters({
      location: { pathParams },
      routing: { path: TesterRouteNames.CAMPAIGN },
    }),
  },
  decorators: [withRouter],
} satisfies Meta<typeof TesterCampaignLandingPage>

export default meta
type Story = StoryObj<typeof meta>

export const Fresh: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockTesterContext),
        seed.tester.localSessionsByCampaignId({}),
      ),
      services: { reviewCampaignsTester: buildMockTesterService() },
    }),
  ],
}

export const WithPastSessions: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockTesterContext),
        seed.tester.localSessionsByCampaignId({ [mockTesterContext.id]: mockSessions }),
      ),
      services: {
        reviewCampaignsTester: buildMockTesterService({
          myTesterSessions: mockSessionSummaries,
        }),
      },
    }),
  ],
}

export const ParticipationFinished: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockTesterContext),
        seed.tester.localSessionsByCampaignId({ [mockTesterContext.id]: mockSessions }),
        seed.tester.surveyByCampaignId({ [mockTesterContext.id]: mockSurvey }),
      ),
      services: {
        reviewCampaignsTester: buildMockTesterService({
          myTesterSessions: mockSessionSummaries,
          myTesterSurvey: mockSurvey,
        }),
      },
    }),
  ],
}

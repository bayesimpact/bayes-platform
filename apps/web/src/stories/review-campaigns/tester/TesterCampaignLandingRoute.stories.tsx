import type { Meta, StoryObj } from "@storybook/react-vite"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { TesterRoutes } from "@/tester/routes/helpers"
import { SessionsRoute } from "@/tester/routes/SessionsRoute"
import { mockProject } from "../fixtures"
import { mockSessionSummaries, mockSessions, mockSurvey, mockTesterContext } from "./fixtures"
import { buildMockTesterService } from "./mock-service"

const pathParams = {
  organizationId: mockProject.organizationId,
  projectId: mockProject.id,
  reviewCampaignId: mockTesterContext.id,
}

const meta = {
  title: "review-campaigns/tester/pages/TesterCampaignLandingRoute",
  component: SessionsRoute,
  parameters: {
    layout: "fullscreen",
    reactRouter: reactRouterParameters({
      location: { pathParams },
      routing: { path: TesterRoutes.campaign.build(pathParams) },
    }),
  },
  decorators: [withRouter],
} satisfies Meta<typeof SessionsRoute>

export default meta
type Story = StoryObj<typeof meta>

export const Fresh: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.tester.context(mockTesterContext),
        seed.tester.campaignSessions([]),
        seed.tester.campaignSurvey(null),
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
        seed.tester.campaignSessions(mockSessions),
        seed.tester.campaignSurvey(null),
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
        seed.tester.campaignSessions(mockSessions),
        seed.tester.campaignSurvey(mockSurvey),
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

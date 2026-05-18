import { TesterAgentSessionPage } from "@/tester/features/review-campaigns/components/TesterAgentSessionPage"
import { TesterCampaignLandingPage } from "@/tester/features/review-campaigns/components/TesterCampaignLandingPage"
import { TesterEndOfPhaseSurveyPage } from "@/tester/features/review-campaigns/components/TesterEndOfPhaseSurveyPage"
import { TesterMyCampaignsPage } from "@/tester/features/review-campaigns/components/TesterMyCampaignsPage"
import { TesterRoutes } from "./helpers"
import { TesterCampaignRoute } from "./TesterCampaignRoute"
import { TesterRoute } from "./TesterRoute"
import { TesterSessionRoute } from "./TesterSessionRoute"

export const testerRoutes = {
  element: <TesterRoute />,
  children: [
    {
      path: TesterRoutes.home.path,
      element: <TesterMyCampaignsPage />,
    },
    {
      element: <TesterCampaignRoute />,
      children: [
        {
          path: TesterRoutes.campaign.path,
          element: <TesterCampaignLandingPage />,
        },
        {
          element: <TesterSessionRoute />,
          children: [
            {
              path: TesterRoutes.session.path,
              element: <TesterAgentSessionPage />,
            },
          ],
        },
        {
          path: TesterRoutes.survey.path,
          element: <TesterEndOfPhaseSurveyPage />,
        },
      ],
    },
  ],
}

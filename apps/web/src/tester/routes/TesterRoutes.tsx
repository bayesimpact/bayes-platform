import { TesterAgentSessionPage } from "@/tester/features/review-campaigns/components/TesterAgentSessionPage"
import { TesterCampaignLandingPage } from "@/tester/features/review-campaigns/components/TesterCampaignLandingPage"
import { TesterEndOfPhaseSurveyPage } from "@/tester/features/review-campaigns/components/TesterEndOfPhaseSurveyPage"
import { TesterMyCampaignsPage } from "@/tester/features/review-campaigns/components/TesterMyCampaignsPage"
import { TesterRouteNames } from "./helpers"
import { TesterCampaignRoute } from "./TesterCampaignRoute"
import { TesterRoute } from "./TesterRoute"
import { TesterSessionRoute } from "./TesterSessionRoute"

export const testerRoutes = {
  element: <TesterRoute />,
  children: [
    {
      path: TesterRouteNames.HOME,
      element: <TesterMyCampaignsPage />,
    },
    {
      element: <TesterCampaignRoute />,
      children: [
        {
          path: TesterRouteNames.CAMPAIGN,
          element: <TesterCampaignLandingPage />,
        },
        {
          element: <TesterSessionRoute />,
          children: [
            {
              path: TesterRouteNames.SESSION,
              element: <TesterAgentSessionPage />,
            },
          ],
        },
        {
          path: TesterRouteNames.SURVEY,
          element: <TesterEndOfPhaseSurveyPage />,
        },
      ],
    },
  ],
}

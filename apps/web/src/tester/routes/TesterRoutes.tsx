import { RestrictedAccess } from "@/studio/routes/RestrictedAccess"
import { TesterAgentSession } from "../features/review-campaigns/components/TesterAgentSession"
import { CampaignRoute } from "./CampaignRoute"
import { TesterRoutes } from "./helpers"
import { SessionRoute } from "./SessionRoute"
import { SessionsRoute } from "./SessionsRoute"
import { TesterEndOfPhaseSurveyRoute } from "./TesterEndOfPhaseSurveyRoute"
import { TesterRoute } from "./TesterRoute"

export const testerRoutes = {
  path: TesterRoutes.home.path,
  element: <TesterRoute />,
  children: [
    {
      path: TesterRoutes.campaign.path,
      element: (
        <CampaignRoute>
          <RestrictedAccess ability="canAccessTester">
            <SessionsRoute />
          </RestrictedAccess>
        </CampaignRoute>
      ),
      children: [
        {
          path: TesterRoutes.session.path,
          element: (
            <SessionRoute>
              <TesterAgentSession />
            </SessionRoute>
          ),
        },
        {
          path: TesterRoutes.survey.path,
          element: <TesterEndOfPhaseSurveyRoute />,
        },
      ],
    },
  ],
}

import { RestrictedAccess } from "@/studio/routes/RestrictedAccess"
import { ReviewerAgentSession } from "../features/review-campaigns/components/ReviewerAgentSession"
import { CampaignRoute } from "./CampaignRoute"
import { ReviewerRoutes } from "./helpers"
import { ReviewerReportRoute } from "./ReviewerReportRoute"
import { ReviewerRoute } from "./ReviewerRoute"
import { SessionRoute } from "./SessionRoute"
import { SessionsRoute } from "./SessionsRoute"

export const reviewerRoutes = {
  path: ReviewerRoutes.home.path,
  element: <ReviewerRoute />,
  children: [
    {
      path: ReviewerRoutes.campaign.path,
      element: (
        <CampaignRoute>
          <RestrictedAccess ability="canAccessReviewer">
            <SessionsRoute />
          </RestrictedAccess>
        </CampaignRoute>
      ),
      children: [
        {
          path: ReviewerRoutes.session.path,
          element: (
            <SessionRoute>
              <ReviewerAgentSession />,
            </SessionRoute>
          ),
        },
        {
          path: ReviewerRoutes.report.path,
          element: <ReviewerReportRoute />,
        },
      ],
    },
  ],
}

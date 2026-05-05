import { ReviewerCampaignPage } from "@/reviewer/features/review-campaigns/components/ReviewerCampaignPage"
import { ReviewerSessionReviewPage } from "@/reviewer/features/review-campaigns/components/ReviewerSessionReviewPage"
import { ReviewerCampaignRoute } from "@/reviewer/routes/ReviewerCampaignRoute"
import { ReviewerRouteNames } from "./helpers"
import { ReviewerCampaignsRoute } from "./ReviewerCampaignsRoute"
import { ReviewerReportRoute } from "./ReviewerReportRoute"
import { ReviewerRoute } from "./ReviewerRoute"
import { ReviewerSessionRoute } from "./ReviewerSessionRoute"

export const reviewerRoutes = {
  element: <ReviewerRoute />,
  children: [
    {
      path: ReviewerRouteNames.HOME,
      element: <ReviewerCampaignsRoute />,
    },
    {
      element: <ReviewerCampaignRoute />,
      children: [
        {
          path: ReviewerRouteNames.CAMPAIGN,
          element: <ReviewerCampaignPage />,
        },
        {
          path: ReviewerRouteNames.REPORT,
          element: <ReviewerReportRoute />,
        },
        {
          element: <ReviewerSessionRoute />,
          children: [
            {
              path: ReviewerRouteNames.SESSION,
              element: <ReviewerSessionReviewPage />,
            },
          ],
        },
      ],
    },
  ],
}

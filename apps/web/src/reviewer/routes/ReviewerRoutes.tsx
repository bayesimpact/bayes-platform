import { ReviewerCampaignPage } from "@/reviewer/features/review-campaigns/components/ReviewerCampaignPage"
import { ReviewerSessionReviewPage } from "@/reviewer/features/review-campaigns/components/ReviewerSessionReviewPage"
import { ReviewerCampaignRoute } from "@/reviewer/routes/ReviewerCampaignRoute"
import { ReviewerRoutes } from "./helpers"
import { ReviewerCampaignsRoute } from "./ReviewerCampaignsRoute"
import { ReviewerReportRoute } from "./ReviewerReportRoute"
import { ReviewerRoute } from "./ReviewerRoute"
import { ReviewerSessionRoute } from "./ReviewerSessionRoute"

export const reviewerRoutes = {
  element: <ReviewerRoute />,
  children: [
    {
      path: ReviewerRoutes.home.path,
      element: <ReviewerCampaignsRoute />,
    },
    {
      element: <ReviewerCampaignRoute />,
      children: [
        {
          path: ReviewerRoutes.campaign.path,
          element: <ReviewerCampaignPage />,
        },
        {
          path: ReviewerRoutes.report.path,
          element: <ReviewerReportRoute />,
        },
        {
          element: <ReviewerSessionRoute />,
          children: [
            {
              path: ReviewerRoutes.session.path,
              element: <ReviewerSessionReviewPage />,
            },
          ],
        },
      ],
    },
  ],
}

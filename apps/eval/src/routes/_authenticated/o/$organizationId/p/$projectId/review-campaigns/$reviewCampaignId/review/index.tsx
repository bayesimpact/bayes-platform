import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadReviewerSessions, ReviewerCampaignPage } from "@/features/campaign-review"
import { CampaignsPageSkeleton } from "@/features/campaigns"

/** A campaign for one of its reviewers: the sessions to review. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/",
)({
  beforeLoad: ({ context }) => {
    if (!context.campaignRoles.includes("reviewer")) throw notFound()
  },
  loader: ({ context, params }) => loadReviewerSessions(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: ReviewerCampaignRoute,
})

function ReviewerCampaignRoute() {
  return <ReviewerCampaignPage campaign={Route.useParams()} />
}

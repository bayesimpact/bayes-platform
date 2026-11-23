import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadReviewerSession, ReviewerSessionPage } from "@/features/campaign-review"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import { uuidParams } from "@/lib/not-found"

/** A tester's session, for a reviewer of its campaign. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/sessions/$sessionId",
)({
  params: { parse: uuidParams("sessionId") },
  beforeLoad: ({ context }) => {
    if (!context.campaignRoles.includes("reviewer")) throw notFound()
  },
  loader: ({ context, params }) => loadReviewerSession(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: ReviewerSessionRoute,
})

function ReviewerSessionRoute() {
  const params = Route.useParams()
  // Each session gets its own page: its form starts from that session's review.
  return <ReviewerSessionPage key={params.sessionId} sessionParams={params} />
}

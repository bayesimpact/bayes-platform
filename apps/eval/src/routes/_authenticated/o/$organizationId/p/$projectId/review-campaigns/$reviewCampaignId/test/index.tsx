import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadTesterCampaign, TesterCampaignPage } from "@/features/campaign-test"
import { CampaignsPageSkeleton } from "@/features/campaigns"

/** A campaign for one of its testers: their sessions and the final survey. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/",
)({
  beforeLoad: ({ context }) => {
    if (!context.campaignRoles.includes("tester")) throw notFound()
  },
  loader: ({ context, params }) => loadTesterCampaign(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: TesterCampaignRoute,
})

function TesterCampaignRoute() {
  return <TesterCampaignPage campaign={Route.useParams()} />
}

import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  CampaignsPage,
  CampaignsPageSkeleton,
  loadCampaigns,
  requireCampaignAgent,
} from "@/features/campaigns"

/** The review campaigns of an agent. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/",
)({
  beforeLoad: ({ context }) => requireCampaignAgent(context.agent),
  loader: ({ context, params }) => loadCampaigns(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: CampaignsRoute,
})

function CampaignsRoute() {
  const { agent } = Route.useRouteContext()
  return <CampaignsPage agent={agent} agentParams={Route.useParams()} />
}

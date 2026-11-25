import { PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION } from "@bayes-platform/eval-contracts"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { hasProjectPermission } from "@/features/agents"
import {
  CampaignsPageSkeleton,
  loadNewCampaign,
  NewCampaignPage,
  requireCampaignAgent,
} from "@/features/campaigns"

/** A new review campaign for an agent, for who may create one. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/new",
)({
  beforeLoad: ({ context }) => {
    requireCampaignAgent(context.agent)
    if (!hasProjectPermission(context.agent.project, PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION)) {
      throw notFound()
    }
  },
  loader: ({ context, params }) => loadNewCampaign(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: NewCampaignRoute,
})

function NewCampaignRoute() {
  const { agent } = Route.useRouteContext()
  return <NewCampaignPage agent={agent} agentParams={Route.useParams()} />
}

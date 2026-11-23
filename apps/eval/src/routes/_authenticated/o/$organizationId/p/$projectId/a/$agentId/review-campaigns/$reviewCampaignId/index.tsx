import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  CampaignPage,
  CampaignsPageSkeleton,
  campaignEditorSearchSchema,
  loadCampaignSetup,
  requireCampaignAgent,
} from "@/features/campaigns"
import { uuidParams } from "@/lib/not-found"

/** A review campaign, for who manages it: its setup, its participants and its summary. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId/",
)({
  params: { parse: uuidParams("reviewCampaignId") },
  validateSearch: campaignEditorSearchSchema,
  beforeLoad: ({ context }) => requireCampaignAgent(context.agent),
  loader: ({ context, params }) => loadCampaignSetup(context.queryClient, params, context.agent),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: CampaignRoute,
})

function CampaignRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { tab, step, preview } = Route.useSearch()
  return (
    <CampaignPage
      // A campaign's form starts from that campaign: another one gets its own.
      key={params.reviewCampaignId}
      agent={agent}
      agentParams={params}
      campaignParams={params}
      tab={tab}
      step={step}
      preview={preview}
    />
  )
}

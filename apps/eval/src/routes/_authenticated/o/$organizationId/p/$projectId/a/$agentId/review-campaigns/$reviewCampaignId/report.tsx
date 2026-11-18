import { Trans } from "@lingui/react/macro"
import { createFileRoute } from "@tanstack/react-router"
import { BackLink } from "@/components/shared/BackLink"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { CampaignReport, loadCampaignReport } from "@/features/campaign-report"
import { CampaignsPageSkeleton, requireCampaignAgent } from "@/features/campaigns"
import { uuidParams } from "@/lib/not-found"

/** The report of a review campaign, for who manages it. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId/report",
)({
  params: { parse: uuidParams("reviewCampaignId") },
  beforeLoad: ({ context }) => requireCampaignAgent(context.agent),
  loader: ({ context, params }) => loadCampaignReport(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: CampaignReportRoute,
})

function CampaignReportRoute() {
  const params = Route.useParams()
  return (
    <CampaignReport
      campaign={params}
      back={
        <BackLink
          to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId"
          params={params}
        >
          <Trans>Back to the campaign</Trans>
        </BackLink>
      }
    />
  )
}

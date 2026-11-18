import { createFileRoute, notFound } from "@tanstack/react-router"
import { BackLink } from "@/components/shared/BackLink"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { useCampaignContext } from "@/features/campaign-context"
import { CampaignReport, loadCampaignReport } from "@/features/campaign-report"
import { CampaignsPageSkeleton } from "@/features/campaigns"

/** The report of a campaign, for one of its reviewers. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/report",
)({
  beforeLoad: ({ context }) => {
    if (!context.campaignRoles.includes("reviewer")) throw notFound()
  },
  loader: ({ context, params }) => loadCampaignReport(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: ReviewerReportRoute,
})

function ReviewerReportRoute() {
  const params = Route.useParams()
  const campaign = useCampaignContext(params)
  return (
    <CampaignReport
      campaign={params}
      back={
        <BackLink
          to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review"
          params={params}
        >
          {campaign.name}
        </BackLink>
      }
    />
  )
}

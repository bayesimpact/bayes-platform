import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { ParticipantCampaignFrame } from "@/features/campaign-context"
import {
  CampaignReportContent,
  DownloadReportButton,
  loadCampaignReport,
} from "@/features/campaign-report"
import { CampaignsPageSkeleton } from "@/features/campaigns"

/** The report of a campaign, a tab of its pages for one of its reviewers. */
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
  return (
    <ParticipantCampaignFrame
      campaign={params}
      campaignRole="reviewer"
      currentTab="report"
      tabActions={<DownloadReportButton campaign={params} />}
    >
      <CampaignReportContent campaign={params} />
    </ParticipantCampaignFrame>
  )
}

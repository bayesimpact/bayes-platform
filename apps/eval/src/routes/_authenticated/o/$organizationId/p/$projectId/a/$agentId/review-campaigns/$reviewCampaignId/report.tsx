import { TabsContent } from "@caseai-connect/app-ui/components/tabs"
import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  CampaignReportContent,
  DownloadReportButton,
  loadCampaignReport,
} from "@/features/campaign-report"
import {
  CampaignPageFrame,
  CampaignsPageSkeleton,
  loadCampaign,
  requireCampaignAgent,
} from "@/features/campaigns"
import { uuidParams } from "@/lib/not-found"

/** The report of a review campaign, for who manages it: a tab of the campaign, at its own URL. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId/report",
)({
  params: { parse: uuidParams("reviewCampaignId") },
  beforeLoad: ({ context }) => requireCampaignAgent(context.agent),
  loader: async ({ context, params }) => {
    await Promise.all([
      loadCampaign(context.queryClient, params, context.agent),
      loadCampaignReport(context.queryClient, params),
    ])
  },
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: CampaignReportRoute,
})

function CampaignReportRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  return (
    <CampaignPageFrame
      agent={agent}
      agentParams={params}
      campaignParams={params}
      currentTab="report"
      hasUnsavedChanges={false}
      tabActions={<DownloadReportButton campaign={params} />}
    >
      <TabsContent value="report" className="pt-4">
        <CampaignReportContent campaign={params} />
      </TabsContent>
    </CampaignPageFrame>
  )
}

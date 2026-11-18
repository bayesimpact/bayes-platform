import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadTesterSurvey, TesterSurveyPage } from "@/features/campaign-test"
import { CampaignsPageSkeleton } from "@/features/campaigns"

/** The final survey of a campaign, for one of its testers. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/survey",
)({
  beforeLoad: ({ context }) => {
    if (!context.campaignRoles.includes("tester")) throw notFound()
  },
  loader: ({ context, params }) => loadTesterSurvey(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: TesterSurveyRoute,
})

function TesterSurveyRoute() {
  return <TesterSurveyPage campaign={Route.useParams()} />
}

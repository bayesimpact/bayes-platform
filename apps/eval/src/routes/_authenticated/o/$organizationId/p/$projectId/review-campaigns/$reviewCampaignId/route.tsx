import { createFileRoute, notFound, Outlet, useMatchRoute } from "@tanstack/react-router"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { SidebarClosedOnly } from "@/components/shared/SidebarClosedOnly"
import { loadEvaluationWorkspace } from "@/features/agents"
import {
  CampaignSidebarHeader,
  loadCampaignContext,
  useCampaignContext,
} from "@/features/campaign-context"
import { ReviewerSidebarSection } from "@/features/campaign-review"
import { TesterSidebarSection } from "@/features/campaign-test"
import { uuidParams } from "@/lib/not-found"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"
import { MyCampaignsNav } from "@/routes/-components/MyCampaignsNav"

/**
 * The frame of the pages of a campaign for its testers and reviewers: the sidebar with the
 * campaign, its sessions for the role the page is for, and the person's other campaigns; the page
 * in the center. A campaign they hold no role in is not
 * found; the pages below check the role they need.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId",
)({
  params: { parse: uuidParams("organizationId", "projectId", "reviewCampaignId") },
  beforeLoad: async ({ context, params }) => {
    const { myCampaigns } = await loadEvaluationWorkspace(context.queryClient)
    const campaign = myCampaigns.find((candidate) => candidate.id === params.reviewCampaignId)
    if (!campaign) throw notFound()
    return { campaignRoles: campaign.roles }
  },
  loader: async ({ context, params }) => {
    await loadCampaignContext(context.queryClient, params)
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: CampaignLayout,
})

function CampaignLayout() {
  const params = Route.useParams()
  const campaign = useCampaignContext(params)
  const matchRoute = useMatchRoute()
  // The pages under `review` are the reviewer's, every other one the tester's.
  const isReviewing =
    matchRoute({
      to: "/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review",
      fuzzy: true,
    }) !== false
  return (
    <AppShell
      header={
        <CampaignSidebarHeader campaign={params} role={isReviewing ? "reviewer" : "tester"} />
      }
      sidebar={
        <>
          {isReviewing ? (
            <ReviewerSidebarSection campaign={params} />
          ) : (
            <TesterSidebarSection campaign={params} />
          )}
          <MyCampaignsNav currentCampaignId={params.reviewCampaignId} />
        </>
      }
      footer={<AppSidebarFooter />}
      // The sidebar names the campaign; the bar above the page takes over while it is closed.
      title={<SidebarClosedOnly>{campaign.name}</SidebarClosedOnly>}
    >
      <Outlet />
    </AppShell>
  )
}

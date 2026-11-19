import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import { AgentName } from "@/components/shared/AgentName"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { SidebarClosedOnly } from "@/components/shared/SidebarClosedOnly"
import { SidebarMenu } from "@/components/ui/sidebar"
import {
  AgentSidebarHeader,
  findAgent,
  loadEvaluationWorkspace,
  useEvaluationWorkspace,
} from "@/features/agents"
import {
  CampaignSidebarHeader,
  loadCampaignContext,
  useCampaignContext,
} from "@/features/campaign-context"
import { prefetchCampaigns } from "@/features/campaigns"
import { uuidParams } from "@/lib/not-found"
import { AgentSectionsNav } from "@/routes/-components/AgentSectionsNav"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"
import { agentSectionsOf } from "@/routes/-components/agent-sections"
import { CampaignsMenu } from "@/routes/-components/CampaignsMenu"

/**
 * The frame of the pages of a campaign for its testers and reviewers: the sidebar of its agent, as
 * on the agent's own pages, where the campaign shows in the Reviewer or Tester sub-menu of Campaigns; the page in
 * the center. A person who only takes part gets the agent's name and those sub-menus. A campaign they
 * hold no role in is not found; the pages below check the role they need.
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
    const [campaign, { groups }] = await Promise.all([
      loadCampaignContext(context.queryClient, params),
      loadEvaluationWorkspace(context.queryClient),
    ])
    const agentParams = { ...params, agentId: campaign.agent.id }
    const agent = findAgent(groups, agentParams)
    // The sidebar's campaigns must not block the page: their query starts here, unawaited.
    if (agent) prefetchCampaigns(context.queryClient, agent, agentParams)
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: CampaignLayout,
})

function CampaignLayout() {
  const params = Route.useParams()
  const campaign = useCampaignContext(params)
  const { groups } = useEvaluationWorkspace()
  const agentParams = {
    organizationId: params.organizationId,
    projectId: params.projectId,
    agentId: campaign.agent.id,
  }
  const agent = findAgent(groups, agentParams)
  return (
    <AppShell
      header={
        agent ? (
          <AgentSidebarHeader currentAgent={agent} />
        ) : (
          <CampaignSidebarHeader campaign={params} />
        )
      }
      sidebar={
        agent ? (
          <AgentSectionsNav
            agent={agent}
            agentParams={agentParams}
            sections={agentSectionsOf(agent)}
          />
        ) : (
          <SidebarMenu className="p-2">
            <CampaignsMenu agentId={campaign.agent.id} managed={null} />
          </SidebarMenu>
        )
      }
      footer={<AppSidebarFooter />}
      // The sidebar names the agent; the bar above the page takes over while it is closed.
      title={
        <SidebarClosedOnly>
          <AgentName name={campaign.agent.name} type={campaign.agent.type} />
        </SidebarClosedOnly>
      }
    >
      <Outlet />
    </AppShell>
  )
}

import { createFileRoute, notFound, Outlet, useMatchRoute } from "@tanstack/react-router"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { SidebarClosedOnly } from "@/components/shared/SidebarClosedOnly"
import { SidebarSeparator } from "@/components/ui/sidebar"
import {
  AgentSidebarHeader,
  agentSearchSchema,
  findAgent,
  loadEvaluationWorkspace,
  rememberLastAgent,
} from "@/features/agents"
import { CampaignsSidebarSection, prefetchCampaigns } from "@/features/campaigns"
import { uuidParams } from "@/lib/not-found"
import { AgentSectionsNav } from "@/routes/-components/AgentSectionsNav"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"
import { agentSectionsOf } from "@/routes/-components/agent-sections"
import { MyCampaignsNav } from "@/routes/-components/MyCampaignsNav"

/**
 * The frame of every page of an agent: the sidebar with the agent switcher, the sections the
 * agent opens for the person, what the open section lists and the person's menu, the page in the
 * center. An agent the app does not hold for the person is not found.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId")({
  params: { parse: uuidParams("organizationId", "projectId", "agentId") },
  validateSearch: agentSearchSchema,
  beforeLoad: async ({ context, params }) => {
    const { groups } = await loadEvaluationWorkspace(context.queryClient)
    const agent = findAgent(groups, params)
    if (!agent) throw notFound()
    return { agent }
  },
  // The sidebar's campaigns must not block the page: their query starts here, unawaited.
  loader: ({ context, params }) => {
    rememberLastAgent(context.agent.id)
    prefetchCampaigns(context.queryClient, context.agent, params)
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: AgentLayout,
})

function AgentLayout() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const matchRoute = useMatchRoute()
  const sections = agentSectionsOf(agent)
  // The sidebar lists the campaigns on their own pages: another section lists what is its own.
  const isInCampaigns =
    sections.includes("campaigns") &&
    matchRoute({
      to: "/o/$organizationId/p/$projectId/a/$agentId/review-campaigns",
      fuzzy: true,
    }) !== false
  return (
    <AppShell
      header={<AgentSidebarHeader currentAgent={agent} />}
      sidebar={
        <>
          <AgentSectionsNav agentName={agent.name} agentParams={params} sections={sections} />
          {isInCampaigns ? (
            <>
              <SidebarSeparator />
              <CampaignsSidebarSection agent={agent} agentParams={params} />
            </>
          ) : null}
          <MyCampaignsNav />
        </>
      }
      footer={<AppSidebarFooter />}
      // The sidebar names the agent; the bar above the page takes over while it is closed.
      title={<SidebarClosedOnly>{agent.name}</SidebarClosedOnly>}
    >
      <Outlet />
    </AppShell>
  )
}

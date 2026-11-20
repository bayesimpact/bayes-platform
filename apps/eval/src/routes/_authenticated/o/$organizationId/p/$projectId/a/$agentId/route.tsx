import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import { AgentName } from "@/components/shared/AgentName"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { SidebarClosedOnly } from "@/components/shared/SidebarClosedOnly"
import {
  AgentSidebarHeader,
  agentSearchSchema,
  canEvaluate,
  findAgent,
  loadEvaluationWorkspace,
  rememberLastAgent,
} from "@/features/agents"
import { prefetchCampaigns } from "@/features/campaigns"
import { prefetchConversationDatasets } from "@/features/conversation-datasets"
import { prefetchExtractionDatasets } from "@/features/extraction-datasets"
import { uuidParams } from "@/lib/not-found"
import { AgentSectionsNav } from "@/routes/-components/AgentSectionsNav"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"
import { agentSectionsOf } from "@/routes/-components/agent-sections"

/**
 * The frame of every page of an agent: the sidebar with the agent switcher, the sections and
 * menus the agent opens for the person and the person's menu, the page in the
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
  // The sidebar's lists must not block the page: their queries start here, unawaited.
  loader: ({ context, params }) => {
    rememberLastAgent(context.agent.id)
    prefetchCampaigns(context.queryClient, context.agent, params)
    // The sidebar's datasets too, for who evaluates the agent.
    if (canEvaluate(context.agent)) {
      if (context.agent.type === "conversation") {
        prefetchConversationDatasets(context.queryClient, params)
      } else {
        prefetchExtractionDatasets(context.queryClient, params)
      }
    }
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: AgentLayout,
})

function AgentLayout() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const sections = agentSectionsOf(agent)
  return (
    <AppShell
      header={<AgentSidebarHeader currentAgent={agent} />}
      sidebar={<AgentSectionsNav agent={agent} agentParams={params} sections={sections} />}
      footer={<AppSidebarFooter />}
      // The sidebar names the agent; the bar above the page takes over while it is closed.
      title={
        <SidebarClosedOnly>
          <AgentName name={agent.name} type={agent.type} />
        </SidebarClosedOnly>
      }
    >
      <Outlet />
    </AppShell>
  )
}

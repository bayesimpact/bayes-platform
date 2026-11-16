import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { SidebarClosedOnly } from "@/components/shared/SidebarClosedOnly"
import {
  AgentSidebarHeader,
  findAgent,
  loadEvaluationWorkspace,
  rememberLastAgent,
} from "@/features/agents"
import { uuidParams } from "@/lib/not-found"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"

/**
 * The frame of every page of an agent: the sidebar with the agent switcher and the person's menu,
 * the page in the center. An agent the person cannot evaluate is not found.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId")({
  params: { parse: uuidParams("organizationId", "projectId", "agentId") },
  beforeLoad: async ({ context, params }) => {
    const { groups } = await loadEvaluationWorkspace(context.queryClient)
    const agent = findAgent(groups, params)
    if (!agent) throw notFound()
    return { agent }
  },
  loader: ({ context }) => {
    rememberLastAgent(context.agent.id)
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: AgentLayout,
})

function AgentLayout() {
  const { agent } = Route.useRouteContext()
  return (
    <AppShell
      header={<AgentSidebarHeader currentAgent={agent} />}
      footer={<AppSidebarFooter />}
      // The sidebar names the agent; the bar above the page takes over while it is closed.
      title={<SidebarClosedOnly>{agent.name}</SidebarClosedOnly>}
    >
      <Outlet />
    </AppShell>
  )
}

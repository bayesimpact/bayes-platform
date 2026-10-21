import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import { Suspense } from "react"
import { DeskShell } from "@/components/shared/DeskShell"
import { DeskShellSkeleton } from "@/components/shared/DeskShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { CurrentUserMenu } from "@/features/account"
import {
  AgentSidebarHeader,
  agentPathParams,
  findAgent,
  loadDeskAgents,
  rememberLastAgent,
} from "@/features/agents"
import {
  AgentHistory,
  AgentHistorySkeleton,
  NewSessionLink,
  prefetchAgentHistory,
} from "@/features/history"

/**
 * The frame of every page of an agent: the sidebar with the agent switcher and the agent's
 * history, the page in the center. An agent the person cannot use is not found.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId")({
  // The pages below read the agent from the context, to redirect on its type before they load.
  beforeLoad: async ({ context, params }) => {
    const groups = await loadDeskAgents(context.queryClient)
    const agent = findAgent(groups, params)
    if (!agent) throw notFound()
    return { agent, historyAgent: { ...agentPathParams(agent), type: agent.type } }
  },
  // The history must not block the page: its queries start here, unawaited.
  loader: ({ context }) => {
    rememberLastAgent(context.agent.id)
    prefetchAgentHistory(context.queryClient, context.historyAgent)
  },
  pendingComponent: DeskShellSkeleton,
  errorComponent: RouteErrorState,
  component: AgentLayout,
})

function AgentLayout() {
  const { agent, historyAgent } = Route.useRouteContext()
  return (
    <DeskShell
      header={<AgentSidebarHeader currentAgent={agent} />}
      sidebar={
        <>
          <div className="p-2">
            <NewSessionLink agent={historyAgent} />
          </div>
          <Suspense fallback={<AgentHistorySkeleton />}>
            <AgentHistory agent={historyAgent} />
          </Suspense>
        </>
      }
      footer={<CurrentUserMenu />}
      title={agent.name}
    >
      <Outlet />
    </DeskShell>
  )
}

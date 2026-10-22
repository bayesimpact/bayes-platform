import { createFileRoute, notFound, Outlet, useMatch } from "@tanstack/react-router"
import { DeskShell } from "@/components/shared/DeskShell"
import { DeskShellSkeleton } from "@/components/shared/DeskShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  AgentSidebarHeader,
  agentPathParams,
  findAgent,
  loadDeskAgents,
  rememberLastAgent,
} from "@/features/agents"
import { ConversationTitle } from "@/features/conversation"
import { AgentHistorySection, NewSessionLink, prefetchAgentHistory } from "@/features/history"
import { uuidParams } from "@/lib/not-found"
import { DeskSidebarFooter } from "@/routes/-components/DeskSidebarFooter"

/**
 * The frame of every page of an agent: the sidebar with the agent switcher and the agent's
 * history, the page in the center. An agent the person cannot use is not found.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId")({
  params: { parse: uuidParams("organizationId", "projectId", "agentId") },
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
  // The bar names the open conversation, and the agent on its other pages.
  const conversation = useMatch({
    from: "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/as/$agentSessionId",
    shouldThrow: false,
  })
  return (
    <DeskShell
      header={<AgentSidebarHeader currentAgent={agent} />}
      sidebar={
        <>
          <div className="p-2">
            <NewSessionLink agent={historyAgent} />
          </div>
          <AgentHistorySection agent={historyAgent} />
        </>
      }
      footer={<DeskSidebarFooter />}
      title={conversation ? <ConversationTitle conversation={conversation.params} /> : agent.name}
    >
      <Outlet />
    </DeskShell>
  )
}

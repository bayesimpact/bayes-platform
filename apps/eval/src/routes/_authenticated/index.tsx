import { createFileRoute, redirect } from "@tanstack/react-router"
import { AppLogo } from "@/components/shared/AppLogo"
import { AppShell } from "@/components/shared/AppShell"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  agentPathParams,
  chooseDefaultAgent,
  flattenEvaluationAgents,
  loadEvaluationWorkspace,
  NoAgentState,
  readLastAgentId,
} from "@/features/agents"
import { AppSidebarFooter } from "@/routes/-components/AppSidebarFooter"

/** The app's home opens the default agent, or says there is none yet. */
export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    const { groups } = await loadEvaluationWorkspace(context.queryClient)
    const agent = chooseDefaultAgent(flattenEvaluationAgents(groups), readLastAgentId())
    if (agent) {
      throw redirect({
        to: "/o/$organizationId/p/$projectId/a/$agentId",
        params: agentPathParams(agent),
        replace: true,
      })
    }
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
  component: NoAgentRoute,
})

function NoAgentRoute() {
  return (
    <AppShell header={<AppLogo />} footer={<AppSidebarFooter />}>
      <NoAgentState />
    </AppShell>
  )
}

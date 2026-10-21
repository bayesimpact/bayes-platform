import { createFileRoute, redirect } from "@tanstack/react-router"
import { DeskLogo } from "@/components/shared/DeskLogo"
import { DeskShell } from "@/components/shared/DeskShell"
import { DeskShellSkeleton } from "@/components/shared/DeskShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { CurrentUserMenu } from "@/features/account"
import {
  agentPathParams,
  chooseDefaultAgent,
  flattenDeskAgents,
  loadDeskAgents,
  readLastAgentId,
} from "@/features/agents"
import { NoAgentState } from "@/features/sessions"

/** The Desk's home opens a new session with the default agent, or says there is none yet. */
export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    const groups = await loadDeskAgents(context.queryClient)
    const agent = chooseDefaultAgent(flattenDeskAgents(groups), readLastAgentId())
    if (agent) {
      throw redirect({
        to: "/o/$organizationId/p/$projectId/a/$agentId",
        params: agentPathParams(agent),
        replace: true,
      })
    }
  },
  pendingComponent: DeskShellSkeleton,
  errorComponent: RouteErrorState,
  component: NoAgentRoute,
})

function NoAgentRoute() {
  return (
    <DeskShell header={<DeskLogo />} footer={<CurrentUserMenu />}>
      <NoAgentState />
    </DeskShell>
  )
}

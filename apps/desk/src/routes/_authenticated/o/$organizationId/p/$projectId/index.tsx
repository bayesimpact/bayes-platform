import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { DeskShellSkeleton } from "@/components/shared/DeskShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  agentPathParams,
  findProjectDefaultAgent,
  loadDeskAgents,
  readLastAgentId,
} from "@/features/agents"

/** A project has no page of its own: its URL opens a new session with its default agent. */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/")({
  loader: async ({ context, params }) => {
    const groups = await loadDeskAgents(context.queryClient)
    const agent = findProjectDefaultAgent(groups, params, readLastAgentId())
    if (!agent) throw notFound()
    throw redirect({
      to: "/o/$organizationId/p/$projectId/a/$agentId",
      params: agentPathParams(agent),
      replace: true,
    })
  },
  pendingComponent: DeskShellSkeleton,
  errorComponent: RouteErrorState,
})

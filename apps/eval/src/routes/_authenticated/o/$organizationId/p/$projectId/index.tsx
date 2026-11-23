import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  agentPathParams,
  findProjectDefaultAgent,
  loadEvaluationWorkspace,
  readLastAgentId,
  switchableAgentCountOf,
} from "@/features/agents"

/**
 * A project has no page of its own: its URL, where the Studio's app menu leads, opens the project's
 * default agent. As on the app's home, a person with several agents gets the command center over
 * it, so they can go elsewhere at once.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/")({
  loader: async ({ context, params }) => {
    const workspace = await loadEvaluationWorkspace(context.queryClient)
    const agent = findProjectDefaultAgent(workspace.groups, params, readLastAgentId())
    if (!agent) throw notFound()
    throw redirect({
      to: "/o/$organizationId/p/$projectId/a/$agentId",
      params: agentPathParams(agent),
      search: switchableAgentCountOf(workspace) > 1 ? { switchAgent: true } : {},
      replace: true,
    })
  },
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
})

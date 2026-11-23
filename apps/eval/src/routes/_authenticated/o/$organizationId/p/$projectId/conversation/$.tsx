import { createFileRoute } from "@tanstack/react-router"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadConversationRunAgentId } from "@/features/conversation-runs"
import { compareRunsSearchSchema } from "@/lib/compare-runs-search"
import { redirectFromLegacyEvaluationsUrl } from "@/routes/-components/legacy-evaluations-redirect"

/**
 * The URLs of the former evaluation app for the conversation evaluations of a project, which the
 * Studio still links to: each one opens the same page under an agent of the project.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/conversation/$",
)({
  validateSearch: compareRunsSearchSchema,
  loaderDeps: ({ search }) => ({ runs: search.runs }),
  loader: ({ context, params, deps }) =>
    redirectFromLegacyEvaluationsUrl({
      queryClient: context.queryClient,
      project: params,
      type: "conversation",
      path: params._splat ?? "",
      runs: deps.runs,
      loadRunAgentId: (runId) => loadConversationRunAgentId(context.queryClient, params, runId),
    }),
  pendingComponent: AppShellSkeleton,
  errorComponent: RouteErrorState,
})

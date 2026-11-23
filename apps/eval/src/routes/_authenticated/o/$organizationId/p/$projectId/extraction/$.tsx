import { createFileRoute } from "@tanstack/react-router"
import { AppShellSkeleton } from "@/components/shared/AppShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadExtractionRunAgentId } from "@/features/extraction-runs"
import { compareRunsSearchSchema } from "@/lib/compare-runs-search"
import { redirectFromLegacyEvaluationsUrl } from "@/routes/-components/legacy-evaluations-redirect"

/**
 * The URLs of the former evaluation app for the extraction evaluations of a project, which the
 * Studio still links to: each one opens the same page under an agent of the project.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/extraction/$")(
  {
    validateSearch: compareRunsSearchSchema,
    loaderDeps: ({ search }) => ({ runs: search.runs }),
    loader: ({ context, params, deps }) =>
      redirectFromLegacyEvaluationsUrl({
        queryClient: context.queryClient,
        project: params,
        type: "extraction",
        path: params._splat ?? "",
        runs: deps.runs,
        loadRunAgentId: (runId) => loadExtractionRunAgentId(context.queryClient, params, runId),
      }),
    pendingComponent: AppShellSkeleton,
    errorComponent: RouteErrorState,
  },
)

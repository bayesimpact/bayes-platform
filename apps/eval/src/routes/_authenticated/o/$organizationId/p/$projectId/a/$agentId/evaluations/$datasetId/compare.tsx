import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  extractionDatasetOfProjectQueryOptions,
  loadExtractionDatasets,
} from "@/features/extraction-datasets"
import {
  compareRunsSearchSchema,
  ExtractionRunsComparePage,
  loadExtractionRuns,
  runIdsOf,
} from "@/features/extraction-runs"
import { uuidParams } from "@/lib/not-found"

/**
 * Runs of an extraction agent on a dataset, side by side: the `runs` search param names them,
 * and `page` is the page of their records.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/compare",
)({
  params: { parse: uuidParams("datasetId") },
  validateSearch: compareRunsSearchSchema,
  beforeLoad: ({ context }) => {
    requireEvaluationAgent(context.agent)
    // Only the runs of an extraction agent compare.
    if (context.agent.type !== "extraction") throw notFound()
  },
  loader: ({ context, params }) =>
    Promise.all([
      loadExtractionDatasets(context.queryClient, params),
      loadExtractionRuns(context.queryClient, params),
    ]),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: CompareRunsRoute,
})

function CompareRunsRoute() {
  const params = Route.useParams()
  const { runs, page } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: dataset } = useSuspenseQuery(
    extractionDatasetOfProjectQueryOptions(params, params.datasetId),
  )
  // A dataset the project does not hold has no run to compare.
  if (!dataset) throw notFound()
  return (
    <ExtractionRunsComparePage
      agentParams={params}
      dataset={dataset}
      runIds={runIdsOf(runs)}
      page={page ?? 0}
      onPageChange={(next) =>
        void navigate({ search: (previous) => ({ ...previous, page: next }), replace: true })
      }
    />
  )
}

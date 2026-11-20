import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  conversationDatasetOfProjectQueryOptions,
  loadConversationDatasets,
} from "@/features/conversation-datasets"
import {
  ConversationRunsComparePage,
  loadConversationRuns,
  loadConversationRunsComparison,
} from "@/features/conversation-runs"
import {
  extractionDatasetOfProjectQueryOptions,
  loadExtractionDatasets,
} from "@/features/extraction-datasets"
import { ExtractionRunsComparePage, loadExtractionRuns } from "@/features/extraction-runs"
import { compareRunsSearchSchema, runIdsOf } from "@/lib/compare-runs-search"
import { uuidParams } from "@/lib/not-found"

/**
 * Runs of the agent on a dataset, side by side: the `runs` search param names them, and `page` is
 * the page of their records, for the runs of an extraction agent, which the API pages.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/compare",
)({
  params: { parse: uuidParams("datasetId") },
  validateSearch: compareRunsSearchSchema,
  beforeLoad: ({ context, params, search }) => {
    requireEvaluationAgent(context.agent)
    // No run to compare: back to the runs of the dataset, where they are picked.
    if (runIdsOf(search.runs).length === 0) {
      throw redirect({
        to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
        params,
        search: { tab: "runs" },
        replace: true,
      })
    }
  },
  loaderDeps: ({ search }) => ({ runs: search.runs }),
  loader: ({ context, params, deps }) =>
    context.agent.type === "conversation"
      ? Promise.all([
          loadConversationDatasets(context.queryClient, params),
          loadConversationRuns(context.queryClient, params),
          loadConversationRunsComparison(context.queryClient, params, runIdsOf(deps.runs)),
        ])
      : Promise.all([
          loadExtractionDatasets(context.queryClient, params),
          loadExtractionRuns(context.queryClient, params),
        ]),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: CompareRunsRoute,
})

function CompareRunsRoute() {
  const { agent } = Route.useRouteContext()
  return agent.type === "conversation" ? <ConversationCompareRoute /> : <ExtractionCompareRoute />
}

function ConversationCompareRoute() {
  const params = Route.useParams()
  const { runs } = Route.useSearch()
  const { data: dataset } = useSuspenseQuery(
    conversationDatasetOfProjectQueryOptions(params, params.datasetId),
  )
  // A dataset the project does not hold has no run to compare.
  if (!dataset) throw notFound()
  return (
    <ConversationRunsComparePage agentParams={params} dataset={dataset} runIds={runIdsOf(runs)} />
  )
}

function ExtractionCompareRoute() {
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

import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  conversationDatasetNameQueryOptions,
  loadConversationDatasets,
} from "@/features/conversation-datasets"
import {
  ConversationRunPage,
  loadConversationRun,
  loadConversationRuns,
  runParamsOf,
} from "@/features/conversation-runs"
import {
  extractionDatasetOfProjectQueryOptions,
  loadExtractionDatasets,
} from "@/features/extraction-datasets"
import {
  ExtractionRunPage,
  extractionRunParamsOf,
  loadExtractionRun,
  loadExtractionRuns,
} from "@/features/extraction-runs"
import { uuidParams } from "@/lib/not-found"
import { runSearchSchema } from "@/lib/run-search"

/** A run of an evaluation of the agent on a dataset: its figures and its records. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId",
)({
  params: { parse: uuidParams("datasetId", "runId") },
  // Which results show: the filter of both types of agent, and the page of an extraction run.
  validateSearch: runSearchSchema,
  beforeLoad: ({ context }) => requireEvaluationAgent(context.agent),
  // The page of an extraction run's results, which its loader starts.
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, params, deps }) => {
    const isConversation = context.agent.type === "conversation"
    // The sidebar lists the dataset's runs, and the side panel opens the agent's versions.
    const [isOfDataset] = await Promise.all(
      isConversation
        ? [
            loadConversationRun(context.queryClient, runParamsOf(params, params.runId), {
              datasetId: params.datasetId,
              agentId: params.agentId,
            }),
            loadConversationDatasets(context.queryClient, params),
            loadConversationRuns(context.queryClient, params),
          ]
        : [
            loadExtractionRun(
              context.queryClient,
              extractionRunParamsOf(params, params.runId),
              { datasetId: params.datasetId, agentId: params.agentId },
              deps.search,
            ),
            loadExtractionDatasets(context.queryClient, params),
            loadExtractionRuns(context.queryClient, params),
          ],
    )
    if (!isOfDataset) throw notFound()
  },
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: RunRoute,
})

function RunRoute() {
  const { agent } = Route.useRouteContext()
  return agent.type === "conversation" ? <ConversationRunRoute /> : <ExtractionRunRoute />
}

function ConversationRunRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { result } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: datasetName } = useSuspenseQuery(
    conversationDatasetNameQueryOptions(params, params.datasetId),
  )
  return (
    <ConversationRunPage
      agent={agent}
      agentParams={params}
      dataset={{ id: params.datasetId, name: datasetName }}
      runParams={runParamsOf(params, params.runId)}
      resultFilter={result}
      // Another filter replaces the one in the URL.
      onResultFilterChange={(next) =>
        void navigate({
          search: (previous) => ({ ...previous, result: next === "all" ? undefined : next }),
          replace: true,
        })
      }
    />
  )
}

function ExtractionRunRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: dataset } = useSuspenseQuery(
    extractionDatasetOfProjectQueryOptions(params, params.datasetId),
  )
  // The loader found the run's dataset: it is missing only while its deletion leaves the page.
  if (!dataset) throw notFound()
  return (
    <ExtractionRunPage
      agent={agent}
      agentParams={params}
      dataset={dataset}
      runParams={extractionRunParamsOf(params, params.runId)}
      search={search}
      // Another page, order, search or filter replaces the one in the URL.
      onSearchChange={(next) => void navigate({ search: next, replace: true })}
    />
  )
}

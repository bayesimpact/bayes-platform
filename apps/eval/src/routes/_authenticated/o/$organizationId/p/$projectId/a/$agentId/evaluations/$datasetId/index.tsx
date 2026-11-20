import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import { ConversationDatasetPage, loadConversationDataset } from "@/features/conversation-datasets"
import { loadConversationRuns, loadJudgeModels } from "@/features/conversation-runs"
import { ExtractionDatasetPage, loadExtractionDataset } from "@/features/extraction-datasets"
import { loadExtractionRuns } from "@/features/extraction-runs"
import { datasetSearchSchema, recordsSearchOfDataset } from "@/lib/dataset-search"
import { uuidParams } from "@/lib/not-found"
import { NO_RECORDS_SEARCH } from "@/lib/records-search"

/**
 * A dataset of the agent's project, of the agent's type: all its records, its runs, and the side
 * panel that starts an evaluation on it. An
 * extraction dataset that waits for its file shows what builds its records.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/",
)({
  params: { parse: uuidParams("datasetId") },
  validateSearch: datasetSearchSchema,
  beforeLoad: ({ context }) => requireEvaluationAgent(context.agent),
  // The page of an extraction dataset's records, which its loader starts.
  loaderDeps: ({ search }) => ({ recordsSearch: recordsSearchOfDataset(search) }),
  loader: ({ context, params, deps }) =>
    context.agent.type === "conversation"
      ? Promise.all([
          loadConversationDataset(context.queryClient, params),
          loadConversationRuns(context.queryClient, params),
          // The form that starts a run picks its judge among the project's models.
          loadJudgeModels(context.queryClient, params),
        ])
      : Promise.all([
          loadExtractionDataset(context.queryClient, params, deps.recordsSearch),
          loadExtractionRuns(context.queryClient, params),
        ]),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: DatasetRoute,
})

function DatasetRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const search = Route.useSearch()
  const { tab, run } = search
  const navigate = Route.useNavigate()
  if (agent.type === "conversation") {
    return (
      <ConversationDatasetPage
        agent={agent}
        agentParams={params}
        datasetParams={params}
        tab={tab ?? "records"}
        isStartingRun={run === true}
      />
    )
  }
  return (
    <ExtractionDatasetPage
      agent={agent}
      agentParams={params}
      datasetParams={params}
      tab={tab ?? "records"}
      isStartingRun={run === true}
      recordsSearch={recordsSearchOfDataset(search)}
      // Another page, order or search replaces the one in the URL, and the tab stays.
      onRecordsSearchChange={(next) =>
        void navigate({
          search: (previous) => ({ ...previous, ...NO_RECORDS_SEARCH, ...next }),
          replace: true,
        })
      }
    />
  )
}

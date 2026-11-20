import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import { ConversationDatasetPage, loadConversationDataset } from "@/features/conversation-datasets"
import { loadConversationRuns } from "@/features/conversation-runs"
import { ExtractionDatasetPage, loadExtractionDataset } from "@/features/extraction-datasets"
import { loadExtractionRuns } from "@/features/extraction-runs"
import { datasetSearchSchema } from "@/lib/dataset-search"
import { uuidParams } from "@/lib/not-found"

/**
 * A dataset of the agent's project, of the agent's type: all its records, and its runs. An
 * extraction dataset that waits for its file shows what builds its records.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/",
)({
  params: { parse: uuidParams("datasetId") },
  validateSearch: datasetSearchSchema,
  beforeLoad: ({ context }) => requireEvaluationAgent(context.agent),
  loader: ({ context, params }) =>
    context.agent.type === "conversation"
      ? Promise.all([
          loadConversationDataset(context.queryClient, params),
          loadConversationRuns(context.queryClient, params),
        ])
      : Promise.all([
          loadExtractionDataset(context.queryClient, params),
          loadExtractionRuns(context.queryClient, params),
        ]),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: DatasetRoute,
})

function DatasetRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { tab } = Route.useSearch()
  const DatasetPage =
    agent.type === "conversation" ? ConversationDatasetPage : ExtractionDatasetPage
  return (
    <DatasetPage agent={agent} agentParams={params} datasetParams={params} tab={tab ?? "records"} />
  )
}

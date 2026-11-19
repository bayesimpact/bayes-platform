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
import { uuidParams } from "@/lib/not-found"

/** A run of an evaluation of the agent on a dataset: its figures and all its records. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId",
)({
  params: { parse: uuidParams("datasetId", "runId") },
  beforeLoad: ({ context }) => {
    requireEvaluationAgent(context.agent)
    // Only a conversation agent has conversation runs.
    if (context.agent.type !== "conversation") throw notFound()
  },
  loader: async ({ context, params }) => {
    const [isOfDataset] = await Promise.all([
      loadConversationRun(context.queryClient, runParamsOf(params, params.runId), {
        datasetId: params.datasetId,
      }),
      loadConversationDatasets(context.queryClient, params),
      // The sidebar lists the dataset's runs, and the side panel opens the agent's versions.
      loadConversationRuns(context.queryClient, params),
    ])
    if (!isOfDataset) throw notFound()
  },
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: ConversationRunRoute,
})

function ConversationRunRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { data: datasetName } = useSuspenseQuery(
    conversationDatasetNameQueryOptions(params, params.datasetId),
  )
  return (
    <ConversationRunPage
      agent={agent}
      agentParams={params}
      dataset={{ id: params.datasetId, name: datasetName }}
      runParams={runParamsOf(params, params.runId)}
    />
  )
}

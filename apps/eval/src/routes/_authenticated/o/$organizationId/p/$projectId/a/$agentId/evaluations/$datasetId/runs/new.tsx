import { EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { hasProjectPermission, requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  conversationDatasetOfProjectQueryOptions,
  loadConversationDatasets,
} from "@/features/conversation-datasets"
import { loadConversationRuns, RunEvaluationPage } from "@/features/conversation-runs"
import { uuidParams } from "@/lib/not-found"

/** The page that starts an evaluation of the agent on a dataset, for who creates runs. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/new",
)({
  params: { parse: uuidParams("datasetId") },
  beforeLoad: ({ context }) => {
    requireEvaluationAgent(context.agent)
    const canRun = hasProjectPermission(
      context.agent.project,
      EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
    )
    // Only a conversation agent has conversation runs, and only who creates runs starts one.
    if (context.agent.type !== "conversation" || !canRun) throw notFound()
  },
  loader: ({ context, params }) =>
    Promise.all([
      loadConversationDatasets(context.queryClient, params),
      loadConversationRuns(context.queryClient, params),
    ]),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: RunEvaluationRoute,
})

function RunEvaluationRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { data: dataset } = useSuspenseQuery(
    conversationDatasetOfProjectQueryOptions(params, params.datasetId),
  )
  // A dataset the project does not hold has no evaluation to run.
  if (!dataset) throw notFound()
  return <RunEvaluationPage agent={agent} agentParams={params} dataset={dataset} />
}

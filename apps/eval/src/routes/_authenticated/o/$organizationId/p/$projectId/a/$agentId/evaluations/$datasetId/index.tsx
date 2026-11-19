import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  ConversationDatasetPage,
  conversationDatasetSearchSchema,
  loadConversationDataset,
} from "@/features/conversation-datasets"
import { loadConversationRuns } from "@/features/conversation-runs"
import { uuidParams } from "@/lib/not-found"

/** A conversation dataset of the agent's project: all its records, and its runs. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/",
)({
  params: { parse: uuidParams("datasetId") },
  validateSearch: conversationDatasetSearchSchema,
  beforeLoad: ({ context }) => {
    requireEvaluationAgent(context.agent)
    // Only a conversation agent has conversation datasets.
    if (context.agent.type !== "conversation") throw notFound()
  },
  loader: ({ context, params }) =>
    Promise.all([
      loadConversationDataset(context.queryClient, params),
      loadConversationRuns(context.queryClient, params),
    ]),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: ConversationDatasetRoute,
})

function ConversationDatasetRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { tab } = Route.useSearch()
  return (
    <ConversationDatasetPage
      agent={agent}
      agentParams={params}
      datasetParams={params}
      tab={tab ?? "records"}
    />
  )
}

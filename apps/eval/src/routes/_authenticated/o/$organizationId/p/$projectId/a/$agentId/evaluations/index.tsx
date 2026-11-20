import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  ConversationDatasetsPage,
  loadConversationDatasets,
} from "@/features/conversation-datasets"
import { ExtractionDatasetsPage, loadExtractionDatasets } from "@/features/extraction-datasets"
import { datasetsSearchSchema } from "@/lib/dataset-search"

/**
 * The evaluations of an agent, for who evaluates it: the datasets of its project, those of its
 * type of agent.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/",
)({
  validateSearch: datasetsSearchSchema,
  beforeLoad: ({ context }) => requireEvaluationAgent(context.agent),
  loader: ({ context, params }) =>
    context.agent.type === "conversation"
      ? loadConversationDatasets(context.queryClient, params)
      : loadExtractionDatasets(context.queryClient, params),
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: EvaluationsRoute,
})

function EvaluationsRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { create } = Route.useSearch()
  const DatasetsPage =
    agent.type === "conversation" ? ConversationDatasetsPage : ExtractionDatasetsPage
  return <DatasetsPage agent={agent} agentParams={params} isCreating={create === true} />
}

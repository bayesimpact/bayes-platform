import { Trans } from "@lingui/react/macro"
import { createFileRoute } from "@tanstack/react-router"
import { FlaskConicalIcon } from "lucide-react"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { StatusPage } from "@/components/shared/StatusPage"
import { requireEvaluationAgent } from "@/features/agents"
import { CampaignsPageSkeleton } from "@/features/campaigns"
import {
  ConversationDatasetsPage,
  conversationDatasetsSearchSchema,
  loadConversationDatasets,
} from "@/features/conversation-datasets"

/**
 * The evaluations of an agent, for who evaluates it: the datasets of a conversation agent. Those
 * of an extraction agent are not here yet.
 */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/evaluations/",
)({
  validateSearch: conversationDatasetsSearchSchema,
  beforeLoad: ({ context }) => requireEvaluationAgent(context.agent),
  loader: async ({ context, params }) => {
    if (context.agent.type === "conversation") {
      await loadConversationDatasets(context.queryClient, params)
    }
  },
  pendingComponent: CampaignsPageSkeleton,
  errorComponent: RouteErrorState,
  component: EvaluationsRoute,
})

function EvaluationsRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  const { create } = Route.useSearch()
  if (agent.type === "conversation") {
    return (
      <ConversationDatasetsPage agent={agent} agentParams={params} isCreating={create === true} />
    )
  }
  return (
    <StatusPage
      icon={<FlaskConicalIcon aria-hidden />}
      title={<Trans>Evaluations are not here yet</Trans>}
      description={<Trans>The datasets and the runs of this agent will show on this page.</Trans>}
    />
  )
}

import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import {
  ConversationSkeleton,
  ConversationView,
  loadConversation,
  stopReplyStream,
} from "@/features/conversation"

/** A conversation with a conversation agent: its messages and the message box. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/as/$agentSessionId",
)({
  beforeLoad: ({ context }) => {
    if (context.agent.type !== "conversation") throw notFound()
  },
  loader: ({ context, params }) => loadConversation(context.queryClient, params),
  // Leaving the conversation stops reading its reply; the server finishes writing it.
  onLeave: ({ params }) => stopReplyStream(params.agentSessionId),
  pendingComponent: ConversationSkeleton,
  errorComponent: RouteErrorState,
  component: ConversationRoute,
})

function ConversationRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  return (
    <ConversationView key={params.agentSessionId} conversation={params} agentName={agent.name} />
  )
}

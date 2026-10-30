import { createFileRoute, redirect } from "@tanstack/react-router"
import { NewConversation } from "@/features/conversation"

/** A new conversation with a conversation agent. An extraction agent opens a new extraction. */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId/")({
  beforeLoad: ({ context, params }) => {
    if (context.agent.type === "extraction") {
      throw redirect({
        to: "/o/$organizationId/p/$projectId/a/$agentId/extraction",
        params,
        replace: true,
      })
    }
  },
  component: NewConversationRoute,
})

function NewConversationRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  return <NewConversation key={agent.id} agent={params} agentName={agent.name} />
}

import { createFileRoute, redirect } from "@tanstack/react-router"
import { NewConversation } from "@/features/sessions"

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
  return <NewConversation key={agent.id} agentName={agent.name} />
}

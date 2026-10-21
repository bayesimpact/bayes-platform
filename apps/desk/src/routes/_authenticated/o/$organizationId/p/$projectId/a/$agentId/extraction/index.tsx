import { createFileRoute, redirect } from "@tanstack/react-router"
import { NewExtraction } from "@/features/sessions"

/** A new extraction with an extraction agent. A conversation agent opens a new conversation. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/",
)({
  beforeLoad: ({ context, params }) => {
    if (context.agent.type === "conversation") {
      throw redirect({ to: "/o/$organizationId/p/$projectId/a/$agentId", params, replace: true })
    }
  },
  component: NewExtractionRoute,
})

function NewExtractionRoute() {
  const { agent } = Route.useRouteContext()
  return <NewExtraction agentName={agent.name} />
}

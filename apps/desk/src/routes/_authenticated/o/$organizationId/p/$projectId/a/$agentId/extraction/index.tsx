import { createFileRoute, redirect } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadNewExtraction, NewExtraction, NewExtractionSkeleton } from "@/features/extraction"

/** A new extraction with an extraction agent. A conversation agent opens a new conversation. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/",
)({
  beforeLoad: ({ context, params }) => {
    if (context.agent.type === "conversation") {
      throw redirect({ to: "/o/$organizationId/p/$projectId/a/$agentId", params, replace: true })
    }
  },
  loader: ({ context, params }) => loadNewExtraction(context.queryClient, params),
  pendingComponent: NewExtractionSkeleton,
  errorComponent: RouteErrorState,
  component: NewExtractionRoute,
})

function NewExtractionRoute() {
  const { agent } = Route.useRouteContext()
  const params = Route.useParams()
  // Another agent's page starts afresh, with no upload of the previous one in progress.
  return <NewExtraction key={params.agentId} agent={params} agentName={agent.name} />
}

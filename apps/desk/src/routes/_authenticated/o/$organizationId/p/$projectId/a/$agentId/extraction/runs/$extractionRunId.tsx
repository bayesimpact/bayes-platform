import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { ExtractionRunView, ExtractionSkeleton, loadExtractionRun } from "@/features/extraction"

/** The extraction of one document: the agent reading it, then the fields it filled in. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
)({
  beforeLoad: ({ context }) => {
    if (context.agent.type !== "extraction") throw notFound()
  },
  loader: ({ context, params }) =>
    loadExtractionRun(context.queryClient, params, params.extractionRunId),
  pendingComponent: ExtractionSkeleton,
  errorComponent: RouteErrorState,
  component: ExtractionRunRoute,
})

function ExtractionRunRoute() {
  const { extractionRunId, ...agent } = Route.useParams()
  return <ExtractionRunView key={extractionRunId} agent={agent} runId={extractionRunId} />
}

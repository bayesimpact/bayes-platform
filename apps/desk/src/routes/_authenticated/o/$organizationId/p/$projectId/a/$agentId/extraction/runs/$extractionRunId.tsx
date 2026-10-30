import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireAgentType } from "@/features/agents"
import { ExtractionRunView, ExtractionSkeleton, loadExtractionRun } from "@/features/extraction"
import { uuidParams } from "@/lib/not-found"

/** The extraction of one document: the agent reading it, then the fields it filled in. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId",
)({
  params: { parse: uuidParams("extractionRunId") },
  beforeLoad: ({ context }) => requireAgentType(context.agent, "extraction"),
  loader: ({ context, params }) => loadExtractionRun(context.queryClient, params),
  pendingComponent: ExtractionSkeleton,
  errorComponent: RouteErrorState,
  component: ExtractionRunRoute,
})

function ExtractionRunRoute() {
  const { extractionRunId, ...agent } = Route.useParams()
  return <ExtractionRunView key={extractionRunId} agent={agent} runId={extractionRunId} />
}

import { createFileRoute } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireAgentType } from "@/features/agents"
import { CsvSetup, ExtractionSkeleton, loadCsvSetup } from "@/features/extraction"
import { uuidParams } from "@/lib/not-found"

/** The setup of an uploaded CSV file's run: what the agent reads in each row, on how many rows. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv/$documentId",
)({
  params: { parse: uuidParams("documentId") },
  beforeLoad: ({ context }) => requireAgentType(context.agent, "extraction"),
  loader: ({ context, params }) => loadCsvSetup(context.queryClient, params),
  pendingComponent: ExtractionSkeleton,
  errorComponent: RouteErrorState,
  component: CsvSetupRoute,
})

function CsvSetupRoute() {
  const { documentId, ...agent } = Route.useParams()
  return <CsvSetup key={documentId} agent={agent} documentId={documentId} />
}

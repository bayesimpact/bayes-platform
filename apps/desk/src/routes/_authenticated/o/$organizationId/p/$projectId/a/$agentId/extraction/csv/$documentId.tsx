import { createFileRoute, notFound } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { CsvSetup, ExtractionSkeleton, loadCsvSetup } from "@/features/extraction"

/** The setup of an uploaded CSV file's run: what the agent reads in each row, on how many rows. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv/$documentId",
)({
  beforeLoad: ({ context }) => {
    if (context.agent.type !== "extraction") throw notFound()
  },
  loader: ({ context, params }) => loadCsvSetup(context.queryClient, params, params.documentId),
  pendingComponent: ExtractionSkeleton,
  errorComponent: RouteErrorState,
  component: CsvSetupRoute,
})

function CsvSetupRoute() {
  const { documentId, ...agent } = Route.useParams()
  return <CsvSetup key={documentId} agent={agent} documentId={documentId} />
}

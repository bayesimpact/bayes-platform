import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { requireAgentType } from "@/features/agents"
import {
  CsvRunSkeleton,
  CsvRunView,
  csvRecordsSearchSchema,
  loadCsvRun,
} from "@/features/extraction"
import { uuidParams } from "@/lib/not-found"

/** The extraction of a CSV file: its progress, and its rows a page at a time. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
)({
  params: { parse: uuidParams("csvRunId") },
  validateSearch: csvRecordsSearchSchema,
  // The first page is the page's default: the URL leaves it out.
  search: { middlewares: [stripSearchParams({ page: 0 })] },
  beforeLoad: ({ context }) => requireAgentType(context.agent, "extraction"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => loadCsvRun(context.queryClient, params, deps),
  pendingComponent: CsvRunSkeleton,
  errorComponent: RouteErrorState,
  component: CsvRunRoute,
})

function CsvRunRoute() {
  const { csvRunId, ...agent } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CsvRunView
      key={csvRunId}
      agent={agent}
      csvRunId={csvRunId}
      page={search}
      // Another page of the results keeps the page in the history of the browser.
      onPageChange={(page) => void navigate({ search: page })}
    />
  )
}

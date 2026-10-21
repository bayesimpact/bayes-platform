import { createFileRoute, notFound, stripSearchParams } from "@tanstack/react-router"
import { z } from "zod"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { CsvRunView, ExtractionSkeleton, loadCsvRun } from "@/features/extraction"

/** The page of the results, and their order, as the URL keeps them. */
const searchSchema = z.object({
  page: z.number().int().min(0).catch(0).default(0),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(["asc", "desc"]).optional().catch(undefined),
})

/** The extraction of a CSV file: its progress, and its rows a page at a time. */
export const Route = createFileRoute(
  "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId",
)({
  validateSearch: searchSchema,
  // The first page is the page's default: the URL leaves it out.
  search: { middlewares: [stripSearchParams({ page: 0 })] },
  beforeLoad: ({ context }) => {
    if (context.agent.type !== "extraction") throw notFound()
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    loadCsvRun(context.queryClient, params, params.csvRunId, deps),
  pendingComponent: ExtractionSkeleton,
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

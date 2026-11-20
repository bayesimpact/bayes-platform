import {
  EvalExtractionRunsRoutes,
  EXTRACTION_RUN_RECORDS_PAGE_SIZE,
  type ExtractionRunOutputDto,
  type ExtractionRunParamsDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type RecordsSearch, recordsQueryOf } from "@/lib/records-search"
import {
  ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS,
  isRunActive,
  type RunStatus,
} from "@/lib/run-status"
import { extractionRunKeys } from "./keys"

/** How long after a run completed the API may still be writing its CSV file, in milliseconds. */
const CSV_EXPORT_WAIT_IN_MILLISECONDS = 60_000

/**
 * Whether a run still changes on its own: it is under way, or it just completed and its results
 * as a CSV file, which the API writes after it marks the run as completed, are not there yet.
 */
const isRunChanging = (run: ExtractionRunOutputDto) =>
  isRunActive(run.status) ||
  (run.status === "completed" &&
    run.csvExportDocumentId === null &&
    Date.now() - run.updatedAt < CSV_EXPORT_WAIT_IN_MILLISECONDS)

/**
 * The extraction runs of a project, the newest first. While one of them is under way, the list
 * is read again every few seconds, so its status and its figures follow.
 */
export const projectExtractionRunsQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: extractionRunKeys.ofProject(project),
    queryFn: async ({ signal }) => {
      const runs = await apiRequest(EvalExtractionRunsRoutes.getAll, { params: project, signal })
      return runs.sort((first, second) => second.createdAt - first.createdAt)
    },
    refetchInterval: (query) =>
      query.state.data?.some(isRunChanging) ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS : false,
  })

/** A run, read again every few seconds while it is under way. */
export const extractionRunQueryOptions = (run: ExtractionRunParamsDto) =>
  queryOptions({
    queryKey: extractionRunKeys.detail(run),
    queryFn: async ({ signal, client }) => {
      const read = await apiRequest(EvalExtractionRunsRoutes.getOne, { params: run, signal })
      // The run just ended: its records are read one last time, with their last values.
      const before = client.getQueryData<{ status: RunStatus }>(extractionRunKeys.detail(run))
      if (before && isRunActive(before.status) && !isRunActive(read.status)) {
        void client.invalidateQueries({ queryKey: extractionRunKeys.records(run) })
      }
      return read
    },
    refetchInterval: (query) =>
      query.state.data && isRunChanging(query.state.data)
        ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS
        : false,
  })

/**
 * A page of the records of a run, narrowed and sorted by the API: a run may hold thousands of
 * them. `filters` narrows them further, to one status for instance. Another page, order or search
 * keeps the rows shown until its own arrive. `isActive` reads the page again every few seconds,
 * as the records of a run under way get their values.
 */
export const extractionRunRecordsQueryOptions = (
  run: ExtractionRunParamsDto,
  search: RecordsSearch,
  { filters = {}, isActive = false }: { filters?: Record<string, string>; isActive?: boolean } = {},
) =>
  queryOptions({
    queryKey: extractionRunKeys.recordsPage(run, search, filters),
    queryFn: ({ signal }) =>
      apiRequest(EvalExtractionRunsRoutes.getRecords, {
        params: run,
        query: recordsQueryOf(search, EXTRACTION_RUN_RECORDS_PAGE_SIZE, filters),
        signal,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: isActive ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS : false,
  })

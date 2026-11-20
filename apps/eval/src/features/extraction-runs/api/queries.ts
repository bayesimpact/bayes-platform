import {
  EvalExtractionRunsRoutes,
  EXTRACTION_RUN_RECORDS_PAGE_SIZE,
  type ExtractionRunParamsDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type RecordsSearch, recordsQueryOf } from "@/lib/records-search"
import { ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS, isRunActive } from "@/lib/run-status"
import { extractionRunKeys } from "./keys"

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
      query.state.data?.some((run) => isRunActive(run.status))
        ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS
        : false,
  })

/** A run, read again every few seconds while it is under way. */
export const extractionRunQueryOptions = (run: ExtractionRunParamsDto) =>
  queryOptions({
    queryKey: extractionRunKeys.detail(run),
    queryFn: ({ signal }) => apiRequest(EvalExtractionRunsRoutes.getOne, { params: run, signal }),
    refetchInterval: (query) =>
      query.state.data && isRunActive(query.state.data.status)
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

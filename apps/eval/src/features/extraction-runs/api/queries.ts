import {
  EvalExtractionRunsRoutes,
  EXTRACTION_RUN_RECORDS_PAGE_SIZE,
  type ExtractionRunParamsDto,
  type ExtractionRunRecordOutputDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
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
 * All the records of a run. The API pages them: the app reads every page, one after the other.
 * `isActive` reads them again every few seconds, as the records of a run under way get their
 * values.
 */
export const extractionRunRecordsQueryOptions = (
  run: ExtractionRunParamsDto,
  { isActive }: { isActive: boolean } = { isActive: false },
) =>
  queryOptions({
    queryKey: extractionRunKeys.records(run),
    queryFn: async ({ signal }) => {
      const records: ExtractionRunRecordOutputDto[] = []
      for (let page = 0; ; page += 1) {
        const answer = await apiRequest(EvalExtractionRunsRoutes.getRecords, {
          params: run,
          query: { page, limit: EXTRACTION_RUN_RECORDS_PAGE_SIZE },
          signal,
        })
        records.push(...answer.records)
        // An empty page ends the reading too, should the total change meanwhile.
        if (records.length >= answer.total || answer.records.length === 0) return records
      }
    },
    refetchInterval: isActive ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS : false,
  })

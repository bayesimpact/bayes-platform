import type {
  AgentParamsDto,
  CsvExtractionRecordsOutputDto,
  CsvExtractionRunDetailOutputDto,
  CsvExtractionRunStatusDto,
  ExtractionRunDetailOutputDto,
} from "@caseai-connect/desk-contracts"
import { DeskCsvExtractionsRoutes, DeskExtractionsRoutes } from "@caseai-connect/desk-contracts"
import { pollWhile } from "@caseai-connect/frontend-lib"
import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { ApiError, apiRequest } from "@/lib/api-client"
import type { CsvRecordsPage } from "../schemas"
import { extractionKeys } from "./keys"

/** While a run goes on, its page asks how it goes this often. */
const LIVE_INTERVAL_IN_MILLISECONDS = 2000

/** The rows of a CSV run a page shows at once. */
export const CSV_RECORDS_PAGE_SIZE = 20

/**
 * The extraction of one document. While the agent reads it, the query asks every 2 s how it goes,
 * while the tab is visible.
 */
export const extractionRunQueryOptions = (agent: AgentParamsDto, runId: string) =>
  queryOptions({
    queryKey: extractionKeys.run(agent.agentId, runId),
    queryFn: ({ signal }) =>
      apiRequest(DeskExtractionsRoutes.getOne, {
        params: { ...agent, agentSessionId: runId },
        signal,
      }),
    refetchInterval: pollWhile(
      (run: ExtractionRunDetailOutputDto | undefined) => run?.status === "pending",
      LIVE_INTERVAL_IN_MILLISECONDS,
    ),
  })

/** The status by which the API refuses a CSV file with no header line: the route's only 422. */
const NO_COLUMNS_STATUS = 422

/**
 * The columns of an uploaded CSV file, with their first values. A file with no header line has
 * none: the API's refusal reads here as an empty list, which the setup page explains.
 */
export const csvColumnsQueryOptions = (agent: AgentParamsDto, documentId: string) =>
  queryOptions({
    queryKey: extractionKeys.csvColumns(agent.agentId, documentId),
    queryFn: async ({ signal }) => {
      try {
        return await apiRequest(DeskCsvExtractionsRoutes.getFileColumns, {
          params: { ...agent, documentId },
          signal,
        })
      } catch (error) {
        if (error instanceof ApiError && error.status === NO_COLUMNS_STATUS) return []
        throw error
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
  })

/** Whether a CSV run still goes on, and so shows its progress. */
export const isCsvRunLive = (status: CsvExtractionRunStatusDto) =>
  status === "pending" || status === "running"

/**
 * The extraction of a CSV file. While it goes on, and for a minute after it ends while its results
 * file is on its way, the query asks every 2 s how it goes.
 */
export const csvRunQueryOptions = (agent: AgentParamsDto, csvRunId: string) =>
  queryOptions({
    queryKey: extractionKeys.csvRun(agent.agentId, csvRunId),
    queryFn: ({ signal }) =>
      apiRequest(DeskCsvExtractionsRoutes.getOne, {
        params: { ...agent, agentCsvExtractionRunId: csvRunId },
        signal,
      }),
    refetchInterval: pollWhile(isAwaited, LIVE_INTERVAL_IN_MILLISECONDS),
  })

/** How long after a run ended its results file may still be on its way. */
const EXPORT_DELAY_IN_MILLISECONDS = 60 * 1000

/** Whether a CSV run still changes: it goes on, or its results file is on its way. */
function isAwaited(run: CsvExtractionRunDetailOutputDto | undefined): boolean {
  if (!run) return false
  if (isCsvRunLive(run.status)) return true
  const isExportComing = run.status !== "failed" && run.csvExportDocumentId === null
  return isExportComing && Date.now() - run.updatedAt < EXPORT_DELAY_IN_MILLISECONDS
}

/**
 * A page of a CSV run's rows. While the run goes on, the page refreshes with it; another page
 * keeps the rows shown until it arrives. Whether the run goes on is part of the key: the rows read
 * once more when it ends, since their last poll may predate the last rows' end.
 */
export const csvRecordsQueryOptions = (
  agent: AgentParamsDto,
  csvRunId: string,
  page: CsvRecordsPage,
  isLive: boolean,
) =>
  queryOptions({
    queryKey: extractionKeys.csvRecords(agent.agentId, csvRunId, page, isLive),
    queryFn: ({ signal }) =>
      apiRequest(DeskCsvExtractionsRoutes.getRecords, {
        params: { ...agent, agentCsvExtractionRunId: csvRunId },
        query: { ...page, limit: CSV_RECORDS_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhile(
      (_records: CsvExtractionRecordsOutputDto | undefined) => isLive,
      LIVE_INTERVAL_IN_MILLISECONDS,
    ),
  })

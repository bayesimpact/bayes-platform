import { DeskCsvExtractionsRoutes, DeskExtractionsRoutes } from "@caseai-connect/desk-contracts"
import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { agentParamsOf, type ExtractionAgentRef } from "../extraction-agent"
import { type CsvRecordsPage, extractionKeys } from "./keys"

/** While a run goes on, its page asks how it goes this often. */
const LIVE_INTERVAL_IN_MILLISECONDS = 2000

/** The rows of a CSV run a page shows at once. */
export const CSV_RECORDS_PAGE_SIZE = 20

/** Three failures in a row stop the polling, which an error then replaces. */
const liveInterval = (isLive: boolean, failureCount: number) =>
  isLive && failureCount < 3 ? LIVE_INTERVAL_IN_MILLISECONDS : false

/**
 * The extraction of one document. While the agent reads it, the query asks every 2 s how it goes,
 * while the tab is visible.
 */
export const extractionRunQueryOptions = (agent: ExtractionAgentRef, runId: string) =>
  queryOptions({
    queryKey: extractionKeys.run(agent.agentId, runId),
    queryFn: ({ signal }) =>
      apiRequest(DeskExtractionsRoutes.getOne, {
        params: { ...agentParamsOf(agent), agentSessionId: runId },
        signal,
      }),
    refetchInterval: (query) =>
      liveInterval(query.state.data?.status === "pending", query.state.fetchFailureCount),
  })

/** The columns of an uploaded CSV file, with their first values. */
export const csvColumnsQueryOptions = (agent: ExtractionAgentRef, documentId: string) =>
  queryOptions({
    queryKey: extractionKeys.csvColumns(agent.agentId, documentId),
    queryFn: ({ signal }) =>
      apiRequest(DeskCsvExtractionsRoutes.getFileColumns, {
        params: { ...agentParamsOf(agent), documentId },
        signal,
      }),
    staleTime: Number.POSITIVE_INFINITY,
  })

/** Whether a CSV run still goes on, and so shows its progress. */
export const isCsvRunLive = (status: string) => status === "pending" || status === "running"

/**
 * The extraction of a CSV file. While it goes on, and for a minute after it ends while its results
 * file is on its way, the query asks every 2 s how it goes.
 */
export const csvRunQueryOptions = (agent: ExtractionAgentRef, csvRunId: string) =>
  queryOptions({
    queryKey: extractionKeys.csvRun(agent.agentId, csvRunId),
    queryFn: ({ signal }) =>
      apiRequest(DeskCsvExtractionsRoutes.getOne, {
        params: { ...agentParamsOf(agent), agentCsvExtractionRunId: csvRunId },
        signal,
      }),
    refetchInterval: (query) =>
      liveInterval(isAwaited(query.state.data), query.state.fetchFailureCount),
  })

/** How long after a run ended its results file may still be on its way. */
const EXPORT_DELAY_IN_MILLISECONDS = 60 * 1000

/** Whether a CSV run still changes: it goes on, or its results file is on its way. */
function isAwaited(
  run: { status: string; csvExportDocumentId: string | null; updatedAt: number } | undefined,
) {
  if (!run) return false
  if (isCsvRunLive(run.status)) return true
  const isExportComing = run.status !== "failed" && run.csvExportDocumentId === null
  return isExportComing && Date.now() - run.updatedAt < EXPORT_DELAY_IN_MILLISECONDS
}

/**
 * A page of a CSV run's rows. While the run goes on, the page refreshes with it; another page
 * keeps the rows shown until it arrives.
 */
export const csvRecordsQueryOptions = (
  agent: ExtractionAgentRef,
  csvRunId: string,
  page: CsvRecordsPage,
  isLive: boolean,
) =>
  queryOptions({
    queryKey: extractionKeys.csvRecords(agent.agentId, csvRunId, page),
    queryFn: ({ signal }) =>
      apiRequest(DeskCsvExtractionsRoutes.getRecords, {
        params: { ...agentParamsOf(agent), agentCsvExtractionRunId: csvRunId },
        query: { ...page, limit: CSV_RECORDS_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => liveInterval(isLive, query.state.fetchFailureCount),
  })

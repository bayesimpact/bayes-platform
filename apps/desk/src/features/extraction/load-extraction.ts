import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { extractionDocumentsQueryOptions } from "@/features/history"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime, startQuery } from "@/lib/start-query"
import {
  csvColumnsQueryOptions,
  csvRecordsQueryOptions,
  csvRunQueryOptions,
  extractionRunQueryOptions,
  isCsvRunLive,
} from "./api/queries"
import type { CsvRecordsPage } from "./schemas"

const documentsOf = (queryClient: QueryClient, agent: AgentParamsDto) =>
  queryClient.query({ ...extractionDocumentsQueryOptions(agent), staleTime: loaderStaleTime })

/** Loads the person's documents for a new extraction's page. */
export async function loadNewExtraction(
  queryClient: QueryClient,
  agent: AgentParamsDto,
): Promise<void> {
  await documentsOf(queryClient, agent)
}

/** Loads the extraction of a document, and the documents that name it. */
export async function loadExtractionRun(
  queryClient: QueryClient,
  params: AgentParamsDto & { extractionRunId: string },
): Promise<void> {
  await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...extractionRunQueryOptions(params, params.extractionRunId),
        staleTime: loaderStaleTime,
      }),
      documentsOf(queryClient, params),
    ]),
  )
}

/** Loads the columns of an uploaded CSV file, before its run is set up. */
export async function loadCsvSetup(
  queryClient: QueryClient,
  params: AgentParamsDto & { documentId: string },
): Promise<void> {
  await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...csvColumnsQueryOptions(params, params.documentId),
        staleTime: loaderStaleTime,
      }),
      documentsOf(queryClient, params),
    ]),
  )
}

/**
 * Loads a CSV run, and starts, unawaited, the page of its rows the URL asks for: another page of
 * the rows keeps the page on screen, and its table shows its own wait.
 */
export async function loadCsvRun(
  queryClient: QueryClient,
  params: AgentParamsDto & { csvRunId: string },
  page: CsvRecordsPage,
): Promise<void> {
  const [run] = await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...csvRunQueryOptions(params, params.csvRunId),
        staleTime: loaderStaleTime,
      }),
      documentsOf(queryClient, params),
    ]),
  )
  startQuery(
    queryClient,
    csvRecordsQueryOptions(params, params.csvRunId, page, isCsvRunLive(run.status)),
  )
}

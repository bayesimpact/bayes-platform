import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { extractionDocumentsQueryOptions } from "@/features/history"
import { ApiError } from "@/lib/api-client"
import type { CsvRecordsPage } from "./api/keys"
import {
  csvColumnsQueryOptions,
  csvRecordsQueryOptions,
  csvRunQueryOptions,
  extractionRunQueryOptions,
  isCsvRunLive,
} from "./api/queries"
import type { ExtractionAgentRef } from "./extraction-agent"

/** A run or a file that does not exist, or is not the person's, is not found. */
async function orNotFound(load: () => Promise<unknown>): Promise<void> {
  try {
    await load()
  } catch (error) {
    if (error instanceof ApiError && [403, 404, 422].includes(error.status)) throw notFound()
    throw error
  }
}

const documentsOf = (queryClient: QueryClient, agent: ExtractionAgentRef) =>
  queryClient.query({ ...extractionDocumentsQueryOptions(agent), staleTime: "static" })

/** Loads the person's documents for a new extraction's page. */
export async function loadNewExtraction(
  queryClient: QueryClient,
  agent: ExtractionAgentRef,
): Promise<void> {
  await documentsOf(queryClient, agent)
}

/** Loads the extraction of a document, and the documents that name it. */
export function loadExtractionRun(
  queryClient: QueryClient,
  agent: ExtractionAgentRef,
  runId: string,
): Promise<void> {
  return orNotFound(() =>
    Promise.all([
      queryClient.query({ ...extractionRunQueryOptions(agent, runId), staleTime: "static" }),
      documentsOf(queryClient, agent),
    ]),
  )
}

/** Loads the columns of an uploaded CSV file, before its run is set up. */
export function loadCsvSetup(
  queryClient: QueryClient,
  agent: ExtractionAgentRef,
  documentId: string,
): Promise<void> {
  return orNotFound(() =>
    Promise.all([
      queryClient.query({ ...csvColumnsQueryOptions(agent, documentId), staleTime: "static" }),
      documentsOf(queryClient, agent),
    ]),
  )
}

/** Loads a CSV run and the page of its rows the URL asks for. */
export function loadCsvRun(
  queryClient: QueryClient,
  agent: ExtractionAgentRef,
  csvRunId: string,
  page: CsvRecordsPage,
): Promise<void> {
  return orNotFound(async () => {
    const [run] = await Promise.all([
      queryClient.query({ ...csvRunQueryOptions(agent, csvRunId), staleTime: "static" }),
      documentsOf(queryClient, agent),
    ])
    await queryClient.query({
      ...csvRecordsQueryOptions(agent, csvRunId, page, isCsvRunLive(run.status)),
      staleTime: "static",
    })
  })
}

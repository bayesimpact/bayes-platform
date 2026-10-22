import {
  type CsvExtractionRecordOutputDto,
  type CsvExtractionRunDetailOutputDto,
  DeskAgentSessionsRoutes,
  DeskCsvExtractionsRoutes,
  DeskExtractionsRoutes,
  type ExtractionDocumentOutputDto,
} from "@caseai-connect/desk-contracts"
import { HttpResponse, http } from "msw"
import { buildCsvExtractionRun, buildExtractionRun } from "../factories/agent-sessions.factory"
import type { DeskWorld } from "../factories/desk-world.factory"
import {
  answerFor,
  buildCsvFileColumns,
  buildCsvRecords,
  buildExtractionDocument,
  buildExtractionRunDetail,
  SAMPLE_RESULT,
} from "../factories/extractions.factory"
import { apiError, mockRoute } from "./mock-route"

/** Where the mocked storage takes the uploads, outside the API. */
const STORAGE_ORIGIN = "https://storage.mock.localhost"

/** A run reads its document for a few seconds, as an agent takes them. */
const READING_TIME_IN_MILLISECONDS = 5000

/** The rows a CSV run does between two polls of its page. */
const ROWS_PER_POLL = 3

/** The most rows a mocked CSV run does. */
const MAX_ROWS = 30

/**
 * The extraction routes on a world: uploads, runs that read their document for a few seconds, CSV
 * runs that advance a few rows per poll. A file whose name holds "fail" fails, to show it.
 */
export function extractionHandlers(world: DeskWorld) {
  const presigned = new Map<string, Omit<ExtractionDocumentOutputDto, "id" | "createdAt">>()
  const documentsOf = (agentId: string) => {
    world.extractionDocuments[agentId] ??= []
    return world.extractionDocuments[agentId]
  }
  const findCsvRun = (agentId: string, runId: string) =>
    (world.csvExtractionRuns[agentId] ?? []).find((run) => run.id === runId)

  /** The run of a document reads it for a few seconds, then succeeds, or fails on a "fail" name. */
  const settle = (agentId: string, runId: string) => {
    const detail = world.extractionRunDetails[runId]
    if (!detail || detail.status !== "pending") return
    if (Date.now() - detail.createdAt < READING_TIME_IN_MILLISECONDS) return
    const run = (world.extractionRuns[agentId] ?? []).find((candidate) => candidate.id === runId)
    const fails = run?.documentFileName?.includes("fail") ?? false
    detail.status = fails ? "failed" : "success"
    detail.result = fails ? null : SAMPLE_RESULT
    detail.errorCode = fails ? "EXTRACTION_PROVIDER_ERROR" : null
    detail.errorDetails = fails ? { message: "The model answered 503." } : null
    detail.updatedAt = Date.now()
    if (run) {
      run.status = detail.status
      run.updatedAt = detail.updatedAt
    }
  }

  /** A run's counts, from its rows, as the API keeps them. */
  const summaryOf = (records: CsvExtractionRecordOutputDto[]) => {
    const processed = records.filter((record) => record.status !== "running").length
    const errors = records.filter((record) => record.status === "error").length
    return { total: records.length, processed, errors, running: records.length - processed }
  }

  /** A running CSV run does a few more rows, and ends with its results file. */
  const advance = (run: CsvExtractionRunDetailOutputDto) => {
    if (run.status !== "running" && run.status !== "pending") return
    const records = world.csvRecords[run.id] ?? []
    let remaining = ROWS_PER_POLL
    for (const record of records) {
      if (remaining === 0) break
      if (record.status !== "running") continue
      record.status = "success"
      record.agentRawOutput = answerFor(record.rowIndex)
      remaining -= 1
    }
    run.summary = summaryOf(records)
    const isDone = run.summary.running === 0
    run.status = isDone ? "completed" : "running"
    run.csvExportDocumentId = isDone ? crypto.randomUUID() : null
    run.updatedAt = Date.now()
  }

  return [
    mockRoute(DeskAgentSessionsRoutes.getExtractionRuns, ({ params }) => {
      for (const run of world.extractionRuns[params.agentId] ?? []) settle(params.agentId, run.id)
      return world.extractionRuns[params.agentId] ?? []
    }),
    mockRoute(DeskAgentSessionsRoutes.getCsvExtractionRuns, ({ params }) => {
      const runs = world.csvExtractionRuns[params.agentId] ?? []
      for (const run of runs) advance(run)
      return runs
    }),
    mockRoute(DeskExtractionsRoutes.presignDocument, ({ payload }) => {
      const documentId = crypto.randomUUID()
      presigned.set(documentId, payload.file)
      return { documentId, uploadUrl: `${STORAGE_ORIGIN}/uploads/${documentId}` }
    }),
    // The signed URL of the storage, which no contract describes: it takes the file's bytes.
    http.put(
      `${STORAGE_ORIGIN}/uploads/:documentId`,
      () => new HttpResponse(null, { status: 200 }),
    ),
    mockRoute(DeskExtractionsRoutes.confirmDocument, ({ params, payload }) => {
      const file = presigned.get(payload.documentId)
      if (!file) return apiError(404)
      const document = buildExtractionDocument({ id: payload.documentId, ...file })
      documentsOf(params.agentId).unshift(document)
      if (file.mimeType === "text/csv") world.csvColumns[document.id] = buildCsvFileColumns()
      return document
    }),
    mockRoute(DeskExtractionsRoutes.getMyDocuments, ({ params }) => documentsOf(params.agentId)),
    mockRoute(DeskExtractionsRoutes.deleteMyDocument, ({ params }) => {
      world.extractionDocuments[params.agentId] = documentsOf(params.agentId).filter(
        (document) => document.id !== params.documentId,
      )
      delete world.csvColumns[params.documentId]
      return { success: true }
    }),
    mockRoute(DeskExtractionsRoutes.executeOne, ({ params, payload }) => {
      const document = documentsOf(params.agentId).find(
        (candidate) => candidate.id === payload.documentId,
      )
      if (!document) return apiError(404)
      const run = buildExtractionRun({
        documentId: document.id,
        documentFileName: document.fileName ?? null,
        status: "pending",
        createdAt: Date.now(),
      })
      world.extractionRuns[params.agentId] = [run, ...(world.extractionRuns[params.agentId] ?? [])]
      world.extractionRunDetails[run.id] = buildExtractionRunDetail(run)
      return { runId: run.id }
    }),
    mockRoute(DeskExtractionsRoutes.getOne, ({ params }) => {
      settle(params.agentId, params.agentSessionId)
      return world.extractionRunDetails[params.agentSessionId] ?? apiError(404)
    }),
    mockRoute(DeskExtractionsRoutes.deleteOne, ({ params }) => {
      world.extractionRuns[params.agentId] = (world.extractionRuns[params.agentId] ?? []).filter(
        (run) => run.id !== params.agentSessionId,
      )
      return { success: true }
    }),
    mockRoute(
      DeskCsvExtractionsRoutes.getFileColumns,
      ({ params }) => world.csvColumns[params.documentId] ?? apiError(404),
    ),
    mockRoute(DeskCsvExtractionsRoutes.createOne, ({ params, payload }) => {
      const run = buildCsvExtractionRun({
        csvDocumentId: payload.csvDocumentId,
        columnSchema: payload.columnSchema,
        status: "pending",
        createdAt: Date.now(),
      })
      world.csvExtractionRuns[params.agentId] = [
        run,
        ...(world.csvExtractionRuns[params.agentId] ?? []),
      ]
      return run
    }),
    mockRoute(DeskCsvExtractionsRoutes.executeOne, ({ params, payload }) => {
      const run = findCsvRun(params.agentId, params.agentCsvExtractionRunId)
      if (!run) return apiError(404)
      const columns = world.csvColumns[run.csvDocumentId] ?? buildCsvFileColumns()
      const count = Math.min(payload.recordLimit ?? MAX_ROWS, MAX_ROWS)
      world.csvRecords[run.id] = buildCsvRecords(columns, count, "running")
      run.status = "running"
      run.summary = { total: count, processed: 0, errors: 0, running: count }
      return run
    }),
    mockRoute(DeskCsvExtractionsRoutes.getOne, ({ params }) => {
      const run = findCsvRun(params.agentId, params.agentCsvExtractionRunId)
      if (!run) return apiError(404)
      advance(run)
      return run
    }),
    mockRoute(DeskCsvExtractionsRoutes.getRecords, ({ params, query }) => {
      const run = findCsvRun(params.agentId, params.agentCsvExtractionRunId)
      if (!run) return apiError(404)
      const { page, limit, sortBy, sortOrder } = query
      const records = [...(world.csvRecords[run.id] ?? [])]
      if (sortBy === "status") {
        records.sort((first, second) => first.status.localeCompare(second.status))
      }
      if (sortOrder === "desc") records.reverse()
      return {
        records: records.slice(page * limit, (page + 1) * limit),
        total: records.length,
        page,
        limit,
      }
    }),
    mockRoute(DeskCsvExtractionsRoutes.cancelOne, ({ params }) => {
      const run = findCsvRun(params.agentId, params.agentCsvExtractionRunId)
      if (!run) return apiError(404)
      for (const record of world.csvRecords[run.id] ?? []) {
        if (record.status === "running") record.status = "cancelled"
      }
      run.status = "cancelled"
      run.summary = { ...(run.summary ?? { total: 0, processed: 0, errors: 0 }), running: 0 }
      run.csvExportDocumentId = crypto.randomUUID()
      run.updatedAt = Date.now()
      return run
    }),
    mockRoute(DeskCsvExtractionsRoutes.retryOne, ({ params }) => {
      const run = findCsvRun(params.agentId, params.agentCsvExtractionRunId)
      if (!run) return apiError(404)
      for (const record of world.csvRecords[run.id] ?? []) {
        if (record.status === "success") continue
        record.status = "running"
        record.errorDetails = null
      }
      // As the API does, the run's counts start again with the rows it runs again.
      run.summary = summaryOf(world.csvRecords[run.id] ?? [])
      run.status = "running"
      run.updatedAt = Date.now()
      return run
    }),
    mockRoute(DeskCsvExtractionsRoutes.getExportTemporaryUrl, () => ({
      url: `${STORAGE_ORIGIN}/exports/results.csv`,
    })),
    mockRoute(DeskCsvExtractionsRoutes.deleteOne, ({ params }) => {
      world.csvExtractionRuns[params.agentId] = (
        world.csvExtractionRuns[params.agentId] ?? []
      ).filter((run) => run.id !== params.agentCsvExtractionRunId)
      return { success: true }
    }),
  ]
}

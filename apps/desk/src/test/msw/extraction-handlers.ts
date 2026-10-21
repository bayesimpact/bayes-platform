import type {
  CsvExtractionRunDetailOutputDto,
  ExtractionDocumentOutputDto,
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

const agentPath = "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId"
const runsPath = `${agentPath}/extraction-agent-sessions/live`
const csvRunsPath = `${agentPath}/csv-extraction-runs/live`

/** Where the mocked storage takes the uploads. */
const STORAGE_ORIGIN = "https://storage.mock.localhost"

/** A run reads its document for a few seconds, as an agent takes them. */
const READING_TIME_IN_MILLISECONDS = 5000

/** The rows a CSV run does between two polls of its page. */
const ROWS_PER_POLL = 3

const created = <T>(data: T) => HttpResponse.json({ data }, { status: 201 })
const notFound = () => new HttpResponse(null, { status: 404 })

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
    Object.assign(detail, {
      status: fails ? "failed" : "success",
      result: fails ? null : SAMPLE_RESULT,
      errorCode: fails ? "EXTRACTION_PROVIDER_ERROR" : null,
      errorDetails: fails ? { message: "The model answered 503." } : null,
      updatedAt: Date.now(),
    })
    if (run) Object.assign(run, { status: detail.status, updatedAt: detail.updatedAt })
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
    const processed = records.filter((record) => record.status !== "running").length
    const errors = records.filter((record) => record.status === "error").length
    const isDone = processed === records.length
    Object.assign(run, {
      status: isDone ? "completed" : "running",
      summary: { total: records.length, processed, errors, running: records.length - processed },
      csvExportDocumentId: isDone ? crypto.randomUUID() : null,
      updatedAt: Date.now(),
    })
  }

  return [
    http.post(runsPath, ({ params }) => {
      const agentId = String(params.agentId)
      for (const run of world.extractionRuns[agentId] ?? []) settle(agentId, run.id)
      return HttpResponse.json({ data: world.extractionRuns[agentId] ?? [] })
    }),
    http.get(csvRunsPath, ({ params }) => {
      const runs = world.csvExtractionRuns[String(params.agentId)] ?? []
      for (const run of runs) advance(run)
      return HttpResponse.json({ data: runs })
    }),
    http.post(`${runsPath}/documents/presign`, async ({ request }) => {
      const { payload } = (await request.json()) as {
        payload: { file: { fileName: string; mimeType: string; size: number } }
      }
      const documentId = crypto.randomUUID()
      presigned.set(documentId, payload.file)
      return created({ documentId, uploadUrl: `${STORAGE_ORIGIN}/uploads/${documentId}` })
    }),
    http.put(
      `${STORAGE_ORIGIN}/uploads/:documentId`,
      () => new HttpResponse(null, { status: 200 }),
    ),
    http.post(`${runsPath}/documents/confirm`, async ({ params, request }) => {
      const { payload } = (await request.json()) as { payload: { documentId: string } }
      const file = presigned.get(payload.documentId)
      if (!file) return notFound()
      const document = buildExtractionDocument({ id: payload.documentId, ...file })
      documentsOf(String(params.agentId)).unshift(document)
      if (file.mimeType === "text/csv") world.csvColumns[document.id] = buildCsvFileColumns()
      return created(document)
    }),
    http.post(`${runsPath}/documents/mine`, ({ params }) =>
      HttpResponse.json({ data: documentsOf(String(params.agentId)) }),
    ),
    http.post(`${runsPath}/documents/:documentId/delete`, ({ params }) => {
      const agentId = String(params.agentId)
      world.extractionDocuments[agentId] = documentsOf(agentId).filter(
        (document) => document.id !== params.documentId,
      )
      return HttpResponse.json({ data: { success: true } })
    }),
    http.post(`${runsPath}/execute`, async ({ params, request }) => {
      const agentId = String(params.agentId)
      const { payload } = (await request.json()) as { payload: { documentId: string } }
      const document = documentsOf(agentId).find((candidate) => candidate.id === payload.documentId)
      if (!document) return notFound()
      const run = buildExtractionRun({
        documentId: document.id,
        documentFileName: document.fileName ?? null,
        status: "pending",
        createdAt: Date.now(),
      })
      world.extractionRuns[agentId] = [run, ...(world.extractionRuns[agentId] ?? [])]
      world.extractionRunDetails[run.id] = buildExtractionRunDetail(run)
      return created({ runId: run.id })
    }),
    http.post(`${runsPath}/:agentSessionId/getOne`, ({ params }) => {
      const runId = String(params.agentSessionId)
      settle(String(params.agentId), runId)
      const detail = world.extractionRunDetails[runId]
      return detail ? HttpResponse.json({ data: detail }) : notFound()
    }),
    http.post(`${runsPath}/:agentSessionId/delete`, ({ params }) => {
      const agentId = String(params.agentId)
      world.extractionRuns[agentId] = (world.extractionRuns[agentId] ?? []).filter(
        (run) => run.id !== params.agentSessionId,
      )
      return HttpResponse.json({ data: { success: true } })
    }),
    http.get(`${csvRunsPath}/file/:documentId/columns`, ({ params }) => {
      const columns = world.csvColumns[String(params.documentId)]
      return columns ? HttpResponse.json({ data: columns }) : notFound()
    }),
    http.post(csvRunsPath, async ({ params, request }) => {
      const agentId = String(params.agentId)
      const { payload } = (await request.json()) as {
        payload: {
          csvDocumentId: string
          columnSchema: CsvExtractionRunDetailOutputDto["columnSchema"]
        }
      }
      const run = buildCsvExtractionRun({
        csvDocumentId: payload.csvDocumentId,
        columnSchema: payload.columnSchema,
        status: "pending",
        createdAt: Date.now(),
      })
      world.csvExtractionRuns[agentId] = [run, ...(world.csvExtractionRuns[agentId] ?? [])]
      return created(run)
    }),
    http.post(`${csvRunsPath}/:runId/execute`, async ({ params, request }) => {
      const run = findCsvRun(String(params.agentId), String(params.runId))
      if (!run) return notFound()
      const { payload } = (await request.json()) as { payload: { recordLimit: number | null } }
      const columns = world.csvColumns[run.csvDocumentId] ?? buildCsvFileColumns()
      const count = Math.min(payload.recordLimit ?? 30, 30)
      world.csvRecords[run.id] = buildCsvRecords(columns, count, "running")
      Object.assign(run, {
        status: "running",
        summary: { total: count, processed: 0, errors: 0, running: count },
      })
      return created(run)
    }),
    http.get(`${csvRunsPath}/:runId`, ({ params }) => {
      const run = findCsvRun(String(params.agentId), String(params.runId))
      if (!run) return notFound()
      advance(run)
      return HttpResponse.json({ data: run })
    }),
    http.get(`${csvRunsPath}/:runId/records`, ({ params, request }) => {
      const run = findCsvRun(String(params.agentId), String(params.runId))
      if (!run) return notFound()
      const query = new URL(request.url).searchParams
      const page = Number(query.get("page") ?? 0)
      const limit = Number(query.get("limit") ?? 10)
      const records = [...(world.csvRecords[run.id] ?? [])]
      const sortBy = query.get("sortBy")
      if (sortBy === "status")
        records.sort((first, second) => first.status.localeCompare(second.status))
      if (query.get("sortOrder") === "desc") records.reverse()
      return HttpResponse.json({
        data: {
          records: records.slice(page * limit, (page + 1) * limit),
          total: records.length,
          page,
          limit,
        },
      })
    }),
    http.post(`${csvRunsPath}/:runId/cancel`, ({ params }) => {
      const run = findCsvRun(String(params.agentId), String(params.runId))
      if (!run) return notFound()
      const records = world.csvRecords[run.id] ?? []
      for (const record of records) if (record.status === "running") record.status = "cancelled"
      Object.assign(run, {
        status: "cancelled",
        summary: { ...(run.summary ?? { total: 0, processed: 0, errors: 0 }), running: 0 },
        csvExportDocumentId: crypto.randomUUID(),
        updatedAt: Date.now(),
      })
      return created(run)
    }),
    http.post(`${csvRunsPath}/:runId/retry`, ({ params }) => {
      const run = findCsvRun(String(params.agentId), String(params.runId))
      if (!run) return notFound()
      for (const record of world.csvRecords[run.id] ?? []) {
        if (record.status !== "success")
          Object.assign(record, { status: "running", errorDetails: null })
      }
      Object.assign(run, { status: "running", updatedAt: Date.now() })
      return created(run)
    }),
    http.get(`${csvRunsPath}/:runId/export/temporary-url`, () =>
      HttpResponse.json({ data: { url: `${STORAGE_ORIGIN}/exports/results.csv` } }),
    ),
    http.delete(`${csvRunsPath}/:runId`, ({ params }) => {
      const agentId = String(params.agentId)
      world.csvExtractionRuns[agentId] = (world.csvExtractionRuns[agentId] ?? []).filter(
        (run) => run.id !== params.runId,
      )
      return HttpResponse.json({ data: { success: true } })
    }),
  ]
}

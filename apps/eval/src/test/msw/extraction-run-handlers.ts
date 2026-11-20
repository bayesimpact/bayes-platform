import type { ExtractionRunRecordOutputDto } from "@caseai-connect/eval-contracts"
import { EvalExtractionRunsRoutes } from "@caseai-connect/eval-contracts"
import type { EvalWorld } from "../factories/eval-world.factory"
import { buildExtractionRun, buildExtractionRunRecord } from "../factories/extraction-runs.factory"
import { apiError, mockRoute } from "./mock-route"
import { pageOfRecords } from "./records-page"

/** The value of a run's record under a key of the API: its status, or a value by its prefix. */
function runRecordTextOf(record: ExtractionRunRecordOutputDto, key: string): string {
  if (key === "status") return record.status
  if (key === "errorDetails") return record.errorDetails ?? ""
  if (key.startsWith("input_")) return String(record.datasetRecordData?.[key.slice(6)] ?? "")
  if (key.startsWith("target_")) return String(record.comparison?.[key.slice(7)]?.groundTruth ?? "")
  if (key.startsWith("agent_")) return String(record.comparison?.[key.slice(6)]?.agentValue ?? "")
  return ""
}

/** The extraction runs of a project and their records: list, start, stop, retry, delete. */
export function extractionRunHandlers(world: EvalWorld) {
  const find = (runId: string) => world.extractionRuns.find((entry) => entry.run.id === runId)
  const setStatus = (runId: string, status: "running" | "cancelled") => {
    const entry = find(runId)
    if (!entry) return apiError(404)
    entry.run.status = status
    entry.run.updatedAt = Date.now()
    return entry.run
  }
  return [
    mockRoute(EvalExtractionRunsRoutes.getAll, ({ params }) =>
      world.extractionRuns
        .filter((entry) => entry.projectId === params.projectId)
        .map((entry) => entry.run),
    ),
    mockRoute(
      EvalExtractionRunsRoutes.getOne,
      ({ params }) => find(params.evaluationExtractionRunId)?.run ?? apiError(404),
    ),
    mockRoute(EvalExtractionRunsRoutes.getRecords, ({ params, query }) => {
      const entry = find(params.evaluationExtractionRunId)
      if (!entry) return apiError(404)
      return pageOfRecords(entry.records, query, runRecordTextOf)
    }),
    mockRoute(EvalExtractionRunsRoutes.createOne, ({ params, payload }) => {
      const dataset = world.extractionDatasets.find(
        (entry) => entry.dataset.id === payload.evaluationExtractionDatasetId,
      )
      if (!dataset) return apiError(404)
      const created = buildExtractionRun(
        params.projectId,
        {
          agentId: payload.agentId,
          evaluationExtractionDatasetId: payload.evaluationExtractionDatasetId,
          agentRevision: payload.agentSettingsRevision ?? 3,
          keyMapping: payload.keyMapping,
          status: "pending",
          summary: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        dataset.records.map((record) =>
          buildExtractionRunRecord({
            evaluationExtractionDatasetRecordId: record.id,
            status: "running",
            comparison: null,
            datasetRecordData: record.data,
          }),
        ),
      )
      world.extractionRuns.unshift(created)
      return created.run
    }),
    mockRoute(EvalExtractionRunsRoutes.executeOne, ({ params }) =>
      setStatus(params.evaluationExtractionRunId, "running"),
    ),
    mockRoute(EvalExtractionRunsRoutes.retryOne, ({ params }) =>
      setStatus(params.evaluationExtractionRunId, "running"),
    ),
    mockRoute(EvalExtractionRunsRoutes.cancelOne, ({ params }) =>
      setStatus(params.evaluationExtractionRunId, "cancelled"),
    ),
    mockRoute(EvalExtractionRunsRoutes.deleteOne, ({ params }) => {
      const index = world.extractionRuns.findIndex(
        (entry) => entry.run.id === params.evaluationExtractionRunId,
      )
      if (index === -1) return apiError(404)
      world.extractionRuns.splice(index, 1)
      return { success: true }
    }),
  ]
}

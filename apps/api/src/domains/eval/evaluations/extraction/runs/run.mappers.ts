import type {
  ExtractionRunOutputDto,
  ExtractionRunRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import type { EndpointRequestWithEvaluationExtractionRun } from "@/common/context/request.interface"
import type { EvaluationExtractionRunsService } from "@/domains/evaluations/extraction/runs/evaluation-extraction-runs.service"
import { telemetryTraceUrl } from "@/external/llm/telemetry"

type ExtractionRun = EndpointRequestWithEvaluationExtractionRun["evaluationExtractionRun"]

type ExtractionRunRecord = Awaited<
  ReturnType<EvaluationExtractionRunsService["getRunRecordsPaginated"]>
>["records"][number]

/**
 * A run, with the fields Evaluation reads. The run carries the
 * version it pinned: the context resolver and `listRuns` load it.
 */
export function toExtractionRunDto(run: ExtractionRun): ExtractionRunOutputDto {
  return {
    id: run.id,
    evaluationExtractionDatasetId: run.evaluationExtractionDatasetId,
    agentId: run.agentId,
    agentRevision: run.agentSettings.revision,
    keyMapping: run.keyMapping,
    status: run.status,
    summary: run.summary,
    csvExportDocumentId: run.csvExportDocumentId,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

/** A record of a run, with the fields Evaluation reads. */
export function toExtractionRunRecordDto(
  record: ExtractionRunRecord,
): ExtractionRunRecordOutputDto {
  return {
    id: record.id,
    evaluationExtractionDatasetRecordId: record.evaluationExtractionDatasetRecordId,
    status: record.status,
    comparison: record.comparison,
    errorDetails: record.errorDetails,
    datasetRecordData: record.evaluationExtractionDatasetRecord?.data ?? null,
    traceUrl: record.traceId ? (telemetryTraceUrl(record.traceId) ?? null) : null,
  }
}

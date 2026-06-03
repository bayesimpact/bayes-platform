import type {
  ExecuteEvaluationExtractionRunJobPayload,
  ProcessEvaluationExtractionRunRecordJobPayload,
} from "./evaluation-extraction-run.types"

export const EVALUATION_EXTRACTION_RUN_BATCH_SERVICE = "EVALUATION_EXTRACTION_RUN_BATCH_SERVICE"

export interface EvaluationExtractionRunBatchService {
  enqueueExecuteRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void>
  enqueueRunRecords(payloads: ProcessEvaluationExtractionRunRecordJobPayload[]): Promise<void>
  retryRunRecords(payloads: ProcessEvaluationExtractionRunRecordJobPayload[]): Promise<void>
  removePendingRunRecords(runRecordIds: string[]): Promise<void>
}

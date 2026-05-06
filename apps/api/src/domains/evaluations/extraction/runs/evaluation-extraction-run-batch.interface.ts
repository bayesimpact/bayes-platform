import type { ExecuteEvaluationExtractionRunJobPayload } from "./evaluation-extraction-run.types"

export const EVALUATION_EXTRACTION_RUN_BATCH_SERVICE = "EVALUATION_EXTRACTION_RUN_BATCH_SERVICE"

export interface EvaluationExtractionRunBatchService {
  enqueueExecuteRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void>
  retryExecuteRun(payload: ExecuteEvaluationExtractionRunJobPayload): Promise<void>
  removePendingJob(runId: string): Promise<void>
}

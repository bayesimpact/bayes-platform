import type {
  ExecuteEvaluationConversationRunJobPayload,
  ProcessEvaluationConversationRunRecordJobPayload,
} from "./evaluation-conversation-run.types"

export const EVALUATION_CONVERSATION_RUN_BATCH_SERVICE = "EVALUATION_CONVERSATION_RUN_BATCH_SERVICE"

export interface EvaluationConversationRunBatchService {
  enqueueExecuteRun(payload: ExecuteEvaluationConversationRunJobPayload): Promise<void>
  enqueueRunRecords(payloads: ProcessEvaluationConversationRunRecordJobPayload[]): Promise<void>
  retryRunRecords(payloads: ProcessEvaluationConversationRunRecordJobPayload[]): Promise<void>
  removePendingRunRecords(runRecordIds: string[]): Promise<void>
}

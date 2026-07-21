import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { EvaluationConversationRun } from "./evaluation-conversation-run.entity"

export type ExecuteEvaluationConversationRunJobPayload = {
  evaluationConversationRunId: string
  organizationId: string
  projectId: string
  recordLimit: number | null
}

// The run is an enqueue-time snapshot: the processor re-reads the run and the
// pinned agent/settings from the DB and only uses the snapshot for its id.
export type ProcessEvaluationConversationRunRecordJobPayload = {
  evaluationConversationRun: EvaluationConversationRun
  runRecordId: string
  connectScope: RequiredConnectScope
}

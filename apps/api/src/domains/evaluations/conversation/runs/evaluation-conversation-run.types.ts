import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.types"
import type { EvaluationConversationRun } from "./evaluation-conversation-run.entity"

export type ExecuteEvaluationConversationRunJobPayload = {
  evaluationConversationRunId: string
  organizationId: string
  projectId: string
  recordLimit: number | null
}

export type ProcessEvaluationConversationRunRecordJobPayload = {
  evaluationConversationRun: EvaluationConversationRun
  runRecordId: string
  connectScope: RequiredConnectScope
  agentWithSettings: AgentWithSettingsRunJobPayload
}

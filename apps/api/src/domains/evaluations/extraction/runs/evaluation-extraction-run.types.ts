import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.types"
import type { EvaluationExtractionDatasetSchemaMapping } from "../datasets/evaluation-extraction-dataset.entity"
import type { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"

export type ExecuteEvaluationExtractionRunJobPayload = {
  evaluationExtractionRunId: string
  organizationId: string
  projectId: string
  recordLimit: number | null
}

export type ProcessEvaluationExtractionRunRecordJobPayload = {
  evaluationExtractionRun: EvaluationExtractionRun
  runRecordId: string
  connectScope: RequiredConnectScope
  schemaMapping: EvaluationExtractionDatasetSchemaMapping
  agentWithSettings: AgentWithSettingsRunJobPayload
}

import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { EvaluationExtractionDatasetSchemaMapping } from "../datasets/evaluation-extraction-dataset.entity"
import type { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"

export type ProcessEvaluationExtractionRunRecordJobPayload = {
  evaluationExtractionRun: EvaluationExtractionRun
  runRecordId: string
  connectScope: RequiredConnectScope
  schemaMapping: EvaluationExtractionDatasetSchemaMapping
  agent: Agent
}

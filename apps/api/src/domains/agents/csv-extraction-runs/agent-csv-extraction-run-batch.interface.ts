import type {
  ExecuteAgentCsvExtractionRunJobPayload,
  ProcessAgentCsvExtractionRunRecordJobPayload,
} from "./agent-csv-extraction-run.types"

export const AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE = "AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE"

export interface AgentCsvExtractionRunBatchService {
  enqueueExecuteRun(payload: ExecuteAgentCsvExtractionRunJobPayload): Promise<void>
  enqueueRunRecords(payloads: ProcessAgentCsvExtractionRunRecordJobPayload[]): Promise<void>
  retryRunRecords(payloads: ProcessAgentCsvExtractionRunRecordJobPayload[]): Promise<void>
  removePendingRunRecords(runRecordIds: string[]): Promise<void>
}

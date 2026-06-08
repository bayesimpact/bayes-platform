import { AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO } from "@caseai-connect/api-contracts"

export const AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME =
  process.env.AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME ?? "agent-csv-extraction-run-queue"

export const AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME =
  process.env.AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME ??
  "agent-csv-extraction-run-execute-queue"

export const AGENT_CSV_EXTRACTION_RUN_JOB_NAME = "agent-csv-extraction-run-job"
export const AGENT_CSV_EXTRACTION_RUN_RECORD_JOB_NAME = "agent-csv-extraction-run-record-job"

export const AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL =
  AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO

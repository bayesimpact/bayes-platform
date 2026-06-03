import { EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO } from "@caseai-connect/api-contracts"

export const EVALUATION_EXTRACTION_RUN_QUEUE_NAME =
  process.env.EVALUATION_EXTRACTION_RUN_QUEUE_NAME ?? "evaluation-extraction-run-queue"

export const EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME =
  process.env.EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME ??
  "evaluation-extraction-run-execute-queue"

export const EVALUATION_EXTRACTION_RUN_JOB_NAME = "evaluation-extraction-run-job"
export const EVALUATION_EXTRACTION_RUN_RECORD_JOB_NAME = "evaluation-extraction-run-record-job"

export const EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL =
  EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO

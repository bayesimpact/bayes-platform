import { EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO } from "@caseai-connect/api-contracts"

export const EVALUATION_CONVERSATION_RUN_QUEUE_NAME =
  process.env.EVALUATION_CONVERSATION_RUN_QUEUE_NAME ?? "evaluation-conversation-run-queue"

export const EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME =
  process.env.EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME ??
  "evaluation-conversation-run-execute-queue"

export const EVALUATION_CONVERSATION_RUN_JOB_NAME = "evaluation-conversation-run-job"
export const EVALUATION_CONVERSATION_RUN_RECORD_JOB_NAME = "evaluation-conversation-run-record-job"

export const EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL =
  EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO

export const DEFAULT_EVALUATION_CONVERSATION_RUN_CONCURRENCY = 10
// Number of conversation record jobs processed concurrently by a single worker.
export const EVALUATION_CONVERSATION_RUN_CONCURRENCY =
  Number(process.env.EVALUATION_CONVERSATION_RUN_CONCURRENCY) ||
  DEFAULT_EVALUATION_CONVERSATION_RUN_CONCURRENCY

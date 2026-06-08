import { createAction } from "@reduxjs/toolkit"
import type {
  AgentCsvExtractionRunStatus,
  AgentCsvExtractionRunSummary,
} from "./agent-csv-extraction-runs.models"

// Standalone action so thunks can dispatch it without importing the slice,
// which would create a circular import (slice -> thunks -> slice) and a
// temporal-dead-zone crash when the thunks module is evaluated first.
export const patchRunStatus = createAction<{
  agentCsvExtractionRunId: string
  status: AgentCsvExtractionRunStatus
  summary: AgentCsvExtractionRunSummary | null
  updatedAt: number
}>("agentCsvExtractionRuns/patchRunStatus")

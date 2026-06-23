import type { ExtractionAgentSessionStatus } from "@caseai-connect/api-contracts"
import { createAction } from "@reduxjs/toolkit"

// Standalone action so thunks can dispatch it without importing the slice,
// which would create a circular import (slice -> thunks -> slice).
export const patchExtractionSessionStatus = createAction<{
  extractionAgentSessionId: string
  agentId: string
  status: ExtractionAgentSessionStatus
  updatedAt: number
}>("extractionAgentSessions/patchExtractionSessionStatus")

import type { ExecuteExtractionAgentSessionJobPayload } from "./extraction-agent-session.types"

export const EXTRACTION_AGENT_SESSION_BATCH_SERVICE = "EXTRACTION_AGENT_SESSION_BATCH_SERVICE"

export interface ExtractionAgentSessionBatchService {
  enqueueExecuteRun(payload: ExecuteExtractionAgentSessionJobPayload): Promise<void>
}

import type { BaseAgentSessionTypeDto } from "../../agents/conversation-agent-sessions/conversation-agent-sessions.dto"
import type { TimeType } from "../../generic"

export const EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO =
  "extraction_agent_session_status_changed"

export type ExtractionAgentSessionStatus = "pending" | "success" | "failed"

export type ExtractionAgentSessionSummaryDto = {
  id: string
  agentId: string
  documentId: string
  documentFileName: string | null
  traceUrl?: string
  type: BaseAgentSessionTypeDto
  status: ExtractionAgentSessionStatus
  createdAt: TimeType
  updatedAt: TimeType
}

export type ExtractionAgentSessionDto = ExtractionAgentSessionSummaryDto & {
  result: Record<string, unknown> | null
  errorCode: string | null
  errorDetails: Record<string, unknown> | null
}

export type ExtractionAgentSessionResultDto = {
  runId: string
}

export type ExtractionAgentSessionStatusChangedEventPayload = {
  type: typeof EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO
  extractionAgentSessionId: string
  organizationId: string
  projectId: string
  agentId: string
  status: ExtractionAgentSessionStatus
  updatedAt: TimeType
}

export type ExtractionAgentSessionStatusChangedEventDto = MessageEvent &
  ExtractionAgentSessionStatusChangedEventPayload

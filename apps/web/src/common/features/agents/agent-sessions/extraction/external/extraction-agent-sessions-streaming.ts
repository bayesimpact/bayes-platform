import {
  EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO,
  type ExtractionAgentSessionStatusChangedEventPayload,
  ExtractionAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { readSSEStream, type SSEStreamConfig } from "@/common/sse/sse-stream-reader"
import type { ExtractionAgentSessionStatusChangedEvent } from "../extraction-agent-sessions.models"

export async function streamExtractionAgentSessionStatus(params: {
  organizationId: string
  projectId: string
  agentId: string
  signal?: AbortSignal
  onStatusChanged: (event: ExtractionAgentSessionStatusChangedEvent) => void
}): Promise<void> {
  const { agentId } = params

  const config: SSEStreamConfig<
    ExtractionAgentSessionStatusChangedEventPayload,
    ExtractionAgentSessionStatusChangedEvent
  > = {
    label: "Extraction agent session",
    getStreamPath: (pathParams) =>
      ExtractionAgentSessionsRoutes.streamSessionStatus.getPath({
        organizationId: pathParams.organizationId,
        projectId: pathParams.projectId,
        agentId,
      }),
    isExpectedEvent: (dto) => dto.type === EXTRACTION_AGENT_SESSION_STATUS_CHANGED_CHANNEL_DTO,
    fromDto: (dto) => ({
      extractionAgentSessionId: dto.extractionAgentSessionId,
      agentId: dto.agentId,
      status: dto.status,
      updatedAt: dto.updatedAt,
    }),
  }

  return readSSEStream({
    config,
    organizationId: params.organizationId,
    projectId: params.projectId,
    signal: params.signal,
    onStatusChanged: params.onStatusChanged,
  })
}

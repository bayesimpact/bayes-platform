import {
  AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO,
  type AgentCsvExtractionRunStatusChangedEventPayload,
  AgentCsvExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import { readSSEStream, type SSEStreamConfig } from "@/common/sse/sse-stream-reader"
import type { AgentCsvExtractionRunStatusChangedEvent } from "../agent-csv-extraction-runs.models"

export async function streamAgentCsvExtractionRunStatus(params: {
  organizationId: string
  projectId: string
  agentId: string
  signal?: AbortSignal
  onStatusChanged: (event: AgentCsvExtractionRunStatusChangedEvent) => void
}): Promise<void> {
  const { agentId } = params

  const config: SSEStreamConfig<
    AgentCsvExtractionRunStatusChangedEventPayload,
    AgentCsvExtractionRunStatusChangedEvent
  > = {
    label: "Agent CSV extraction run",
    getStreamPath: (pathParams) =>
      AgentCsvExtractionRunsRoutes.streamRunStatus.getPath({
        organizationId: pathParams.organizationId,
        projectId: pathParams.projectId,
        agentId,
      }),
    isExpectedEvent: (dto) => dto.type === AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO,
    fromDto: (dto) => ({
      agentCsvExtractionRunId: dto.agentCsvExtractionRunId,
      status: dto.status,
      summary: dto.summary,
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

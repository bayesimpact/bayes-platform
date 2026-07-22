import {
  EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO,
  type EvaluationConversationRunStatusChangedEventDto,
  EvaluationConversationRunsRoutes,
} from "@caseai-connect/api-contracts"
import { readSSEStream, type SSEStreamConfig } from "@/common/sse/sse-stream-reader"
import type { EvaluationConversationRunStatusChangedEvent } from "../evaluation-conversation-runs.models"

const evaluationConversationRunSSEConfig: SSEStreamConfig<
  EvaluationConversationRunStatusChangedEventDto,
  EvaluationConversationRunStatusChangedEvent
> = {
  label: "Evaluation conversation run",
  getStreamPath: (params) =>
    EvaluationConversationRunsRoutes.streamRunStatus.getPath({
      organizationId: params.organizationId,
      projectId: params.projectId,
    }),
  isExpectedEvent: (dto) => dto.type === EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO,
  fromDto: (dto) => ({
    evaluationConversationRunId: dto.evaluationConversationRunId,
    status: dto.status,
    summary: dto.summary,
    updatedAt: dto.updatedAt,
  }),
}

export async function streamEvaluationConversationRunStatus(params: {
  organizationId: string
  projectId: string
  signal?: AbortSignal
  onStatusChanged: (event: EvaluationConversationRunStatusChangedEvent) => void
}): Promise<void> {
  return readSSEStream({
    config: evaluationConversationRunSSEConfig,
    organizationId: params.organizationId,
    projectId: params.projectId,
    signal: params.signal,
    onStatusChanged: params.onStatusChanged,
  })
}

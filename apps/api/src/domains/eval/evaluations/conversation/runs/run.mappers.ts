import type {
  ConversationRunOutputDto,
  ConversationRunRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import type { EndpointRequestWithEvaluationConversationRun } from "@/common/context/request.interface"
import type { EvaluationConversationRunsService } from "@/domains/evaluations/conversation/runs/evaluation-conversation-runs.service"
import { telemetryTraceUrl } from "@/external/llm/telemetry"

type ConversationRun = EndpointRequestWithEvaluationConversationRun["evaluationConversationRun"]

type ConversationRunRecord = Awaited<
  ReturnType<EvaluationConversationRunsService["getRunRecordsPaginated"]>
>["records"][number]

/**
 * A copy of `toEvaluationConversationRunDto`, with the fields Evaluation reads. The run carries
 * the version it pinned: the context resolver and `listRuns` load it.
 */
export function toConversationRunDto(run: ConversationRun): ConversationRunOutputDto {
  return {
    id: run.id,
    evaluationConversationDatasetId: run.evaluationConversationDatasetId,
    agentId: run.agentId,
    agentSettings: {
      instructions: run.agentSettings.instructions,
      model: run.agentSettings.model,
      revision: run.agentSettings.revision,
      providerOptions: run.agentSettings.providerOptions,
      documentsRagMode: run.agentSettings.documentsRagMode,
    },
    status: run.status,
    judgeModel: run.judgeModel,
    judgeInstructions: run.judgeInstructions,
    summary: run.summary,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

/** A copy of `toEvaluationConversationRunRecordDto`, with the fields Evaluation reads. */
export function toConversationRunRecordDto(
  record: ConversationRunRecord,
): ConversationRunRecordOutputDto {
  return {
    id: record.id,
    evaluationConversationDatasetRecordId: record.evaluationConversationDatasetRecordId,
    status: record.status,
    input: record.input,
    expectedOutput: record.expectedOutput,
    output: record.output,
    formState: record.formState,
    score: record.score,
    errorDetails: record.errorDetails,
    traceUrl: record.traceId ? (telemetryTraceUrl(record.traceId) ?? null) : null,
  }
}

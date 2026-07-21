import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { EvaluationConversationDatasetRecord } from "../../datasets/records/evaluation-conversation-dataset-record.entity"
import type { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import type { EvaluationConversationRunRecord } from "./evaluation-conversation-run-record.entity"

type EvaluationConversationRunRecordTransientParams = RequiredScopeTransientParams & {
  evaluationConversationRun: EvaluationConversationRun
  evaluationConversationDatasetRecord: EvaluationConversationDatasetRecord
}

class EvaluationConversationRunRecordFactory extends Factory<
  EvaluationConversationRunRecord,
  EvaluationConversationRunRecordTransientParams
> {}

export const evaluationConversationRunRecordFactory = EvaluationConversationRunRecordFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.evaluationConversationRun) {
      throw new Error("evaluationConversationRun transient is required")
    }
    if (!transientParams.evaluationConversationDatasetRecord) {
      throw new Error("evaluationConversationDatasetRecord transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      evaluationConversationRunId: transientParams.evaluationConversationRun.id,
      evaluationConversationRun: transientParams.evaluationConversationRun,
      evaluationConversationDatasetRecordId: transientParams.evaluationConversationDatasetRecord.id,
      evaluationConversationDatasetRecord: transientParams.evaluationConversationDatasetRecord,
      status: params.status || "running",
      input: params.input || transientParams.evaluationConversationDatasetRecord.input,
      expectedOutput:
        params.expectedOutput || transientParams.evaluationConversationDatasetRecord.expectedOutput,
      output: params.output || null,
      score: params.score ?? null,
      errorDetails: params.errorDetails || null,
      traceId: params.traceId || null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
    } satisfies EvaluationConversationRunRecord
  },
)

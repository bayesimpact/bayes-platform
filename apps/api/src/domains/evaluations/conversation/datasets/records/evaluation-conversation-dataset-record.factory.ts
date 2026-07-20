import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"
import type { EvaluationConversationDatasetRecord } from "./evaluation-conversation-dataset-record.entity"

type EvaluationConversationDatasetRecordTransientParams = RequiredScopeTransientParams & {
  evaluationConversationDataset: EvaluationConversationDataset
}

class EvaluationConversationDatasetRecordFactory extends Factory<
  EvaluationConversationDatasetRecord,
  EvaluationConversationDatasetRecordTransientParams
> {}

export const evaluationConversationDatasetRecordFactory =
  EvaluationConversationDatasetRecordFactory.define(({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.evaluationConversationDataset) {
      throw new Error("evaluationConversationDataset transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      evaluationConversationDatasetId: transientParams.evaluationConversationDataset.id,
      evaluationConversationDataset: transientParams.evaluationConversationDataset,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      input: params.input || `Sample question ${sequence}`,
      expectedOutput: params.expectedOutput || `Sample expected answer ${sequence}`,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
    } satisfies EvaluationConversationDatasetRecord
  })

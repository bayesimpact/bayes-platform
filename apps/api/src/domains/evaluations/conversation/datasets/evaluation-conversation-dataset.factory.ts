import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { EvaluationConversationDataset } from "./evaluation-conversation-dataset.entity"

type EvaluationConversationDatasetTransientParams = RequiredScopeTransientParams

class EvaluationConversationDatasetFactory extends Factory<
  EvaluationConversationDataset,
  EvaluationConversationDatasetTransientParams
> {}

export const evaluationConversationDatasetFactory = EvaluationConversationDatasetFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }

    const now = new Date()

    return {
      id: params.id || randomUUID(),
      name: params.name || `Test Dataset ${sequence}`,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      records: params.records || [],
    } satisfies EvaluationConversationDataset
  },
)

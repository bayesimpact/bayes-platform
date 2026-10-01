import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetSchemaMapping,
} from "./evaluation-extraction-dataset.entity"
import type { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"

type EvaluationExtractionDatasetTransientParams = RequiredScopeTransientParams

class EvaluationExtractionDatasetFactory extends Factory<
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetTransientParams
> {}

export const evaluationExtractionDatasetFactory = EvaluationExtractionDatasetFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }

    const now = new Date()
    const schemaMapping = (params.schemaMapping || {}) as EvaluationExtractionDatasetSchemaMapping

    return {
      id: params.id || randomUUID(),
      name: params.name || `Test Dataset ${sequence}`,
      schemaMapping,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      records: params.records || [],
      evaluationExtractionDatasetDocumentId: params.evaluationExtractionDatasetDocumentId ?? null,
      evaluationExtractionDatasetDocument:
        (params.evaluationExtractionDatasetDocument as
          | EvaluationExtractionDatasetDocument
          | undefined) ?? null,
    } satisfies EvaluationExtractionDataset
  },
)

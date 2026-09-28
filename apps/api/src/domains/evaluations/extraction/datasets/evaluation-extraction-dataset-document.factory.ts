import { randomUUID } from "node:crypto"
import { MimeTypes } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"

type EvaluationExtractionDatasetDocumentTransientParams = RequiredScopeTransientParams

class EvaluationExtractionDatasetDocumentFactory extends Factory<
  EvaluationExtractionDatasetDocument,
  EvaluationExtractionDatasetDocumentTransientParams
> {}

export const evaluationExtractionDatasetDocumentFactory =
  EvaluationExtractionDatasetDocumentFactory.define(({ sequence, params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }

    const now = new Date()
    const id = params.id || randomUUID()
    return {
      id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      fileName: params.fileName || `dataset_${sequence}.csv`,
      mimeType: params.mimeType || MimeTypes.csv,
      size: params.size || 1024,
      storageRelativePath: params.storageRelativePath || `evaluation-extraction-datasets/${id}.csv`,
      uploadStatus: params.uploadStatus || "uploaded",
    } satisfies EvaluationExtractionDatasetDocument
  })

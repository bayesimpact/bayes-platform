import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { EvaluationExtractionDataset } from "./evaluation-extraction-dataset.entity"
import type { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"

/** Guards datasets and the files they are built from: both are admin/owner resources of a project. */
export class EvaluationExtractionDatasetPolicy extends ProjectScopedPolicy<
  EvaluationExtractionDataset | EvaluationExtractionDatasetDocument
> {
  canList(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canCreate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canUpdate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() && this.doesResourceBelongToScope()
  }

  canDelete(): boolean {
    return this.canUpdate()
  }
}

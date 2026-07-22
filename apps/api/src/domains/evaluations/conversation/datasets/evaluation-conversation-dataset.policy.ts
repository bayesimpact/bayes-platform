import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { EvaluationConversationDataset } from "./evaluation-conversation-dataset.entity"

export class EvaluationConversationDatasetPolicy extends ProjectScopedPolicy<EvaluationConversationDataset> {
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

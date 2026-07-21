import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { EvaluationConversationRun } from "./evaluation-conversation-run.entity"

export class EvaluationConversationRunPolicy extends ProjectScopedPolicy<EvaluationConversationRun> {
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

import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { AgentMembershipModel } from "./agent-membership.model"

export class AgentMembershipPolicy extends ProjectScopedPolicy<AgentMembershipModel> {
  canList(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() // FIXME: should be isAgentAdminOrOwner
  }

  canCreate(): boolean {
    return this.canList()
  }

  canUpdate(): boolean {
    return this.canList()
  }

  canDelete(): boolean {
    return this.canList()
  }
}

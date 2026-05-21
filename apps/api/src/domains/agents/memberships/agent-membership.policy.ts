import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { AgentMembership } from "./agent-membership.entity"

export class AgentMembershipPolicy extends ProjectScopedPolicy<AgentMembership> {
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

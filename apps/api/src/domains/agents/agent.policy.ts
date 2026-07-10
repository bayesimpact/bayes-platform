import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { OrganizationMembershipContextModel } from "../organizations/memberships/organization-membership.model"
import type { ProjectMembershipFixture } from "../projects/memberships/project-membership.types"
import type { Agent } from "./agent.entity"
import type { AgentMembershipFixture } from "./memberships/agent-membership.types"

export class AgentPolicy extends ProjectScopedPolicy<Agent> {
  protected readonly agentMembership?: AgentMembershipFixture

  constructor(
    protected readonly context: {
      organizationMembership: OrganizationMembershipContextModel
      projectMembership?: ProjectMembershipFixture
      agentMembership?: AgentMembershipFixture
    },
    protected readonly entity?: Agent,
  ) {
    super(context, entity)
    this.agentMembership = context.agentMembership
  }

  canList(): boolean {
    return this.canAccess()
  }

  canCreate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canUpdate(): boolean {
    return this.doesResourceBelongToScope() && this.isAgentAdminOrOwner() && this.canAccessAgent()
  }

  canDelete(): boolean {
    return this.canUpdate()
  }

  protected canAccessAgent(): boolean {
    return this.agentMembership?.agentId === this.entity?.id
  }

  protected isAgentOwner(): boolean {
    return this.agentMembership?.role === "owner"
  }

  protected isAgentAdmin(): boolean {
    return this.agentMembership?.role === "admin"
  }

  protected isAgentAdminOrOwner(): boolean {
    return this.isAgentAdmin() || this.isAgentOwner()
  }
}

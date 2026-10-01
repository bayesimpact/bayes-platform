import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { InvitationTargetType } from "./invitation.types"

/**
 * Minimal structural shape shared by all invitation targets (Project, Agent, ReviewCampaign).
 * `projectId` is optional because Project targets are the project itself (no nested projectId).
 * Using structural types avoids cross-domain entity imports from the invitations domain.
 */
export type InvitationPolicyTarget = {
  id: string
  organizationId: string
  projectId?: string
}

type AgentMembershipLike = {
  agentId: string
  role: "owner" | "admin" | "member"
}

/** Who may invite people to a target, list its pending invitations and revoke them. */
export class InvitationPolicy extends ProjectScopedPolicy<InvitationPolicyTarget> {
  private readonly agentMembership?: AgentMembershipLike
  private readonly targetType?: InvitationTargetType

  constructor(
    context: ConstructorParameters<typeof ProjectScopedPolicy<InvitationPolicyTarget>>[0] & {
      agentMembership?: AgentMembershipLike
    },
    target?: InvitationPolicyTarget,
    targetType?: InvitationTargetType,
  ) {
    super(context, target)
    this.agentMembership = context.agentMembership
    this.targetType = targetType
  }

  canCreate(): boolean {
    return this.canManage()
  }

  canList(): boolean {
    return this.canManage()
  }

  canDelete(): boolean {
    return this.canManage()
  }

  private canManage(): boolean {
    switch (this.targetType) {
      case "agent":
        return this.canManageAgentMembers()
      case "review_campaign":
        // Mirrors ReviewCampaignPolicy.canUpdate(): project admin/owner.
        return this.canManageProjectMembers()
      default:
        return this.canManageProjectMembers()
    }
  }

  private canManageProjectMembers(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() && this.targetBelongsToScope()
  }

  /** Mirrors AgentPolicy.canUpdate(): agent admin/owner on this very agent. */
  private canManageAgentMembers(): boolean {
    return (
      this.canAccess() &&
      this.targetBelongsToScope() &&
      this.isAgentAdminOrOwner() &&
      this.agentMembership?.agentId === this.entity?.id
    )
  }

  private isAgentAdminOrOwner(): boolean {
    return this.agentMembership?.role === "admin" || this.agentMembership?.role === "owner"
  }

  /**
   * Checks that the target belongs to the org/project context. `projectId` is
   * optional: Project targets are the project itself and carry no nested projectId.
   */
  private targetBelongsToScope(): boolean {
    if (!this.entity) return false
    const orgMatch = this.entity.organizationId === this.project?.organizationId
    const projectMatch = !this.entity.projectId || this.entity.projectId === this.project?.id
    return orgMatch && projectMatch
  }
}

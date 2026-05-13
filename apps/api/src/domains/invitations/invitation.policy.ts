import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { Invitation, InvitationTargetType } from "./invitation.entity"

/**
 * Minimal structural shape shared by all invitation targets (Project, Agent, ReviewCampaign).
 * `projectId` is optional because Project targets are the project itself (no nested projectId).
 * Using structural types avoids cross-domain entity imports from the invitations domain.
 */
export type InvitationTarget = {
  id: string
  organizationId: string
  projectId?: string
}

type AgentMembershipLike = {
  agentId: string
  role: "owner" | "admin" | "member"
}

export class InvitationPolicy extends ProjectScopedPolicy<Invitation> {
  private readonly agentMembership?: AgentMembershipLike
  private readonly targetType?: InvitationTargetType
  private readonly target?: InvitationTarget

  constructor(
    context: ConstructorParameters<typeof ProjectScopedPolicy<Invitation>>[0] & {
      agentMembership?: AgentMembershipLike
    },
    entity?: Invitation,
    targetType?: InvitationTargetType,
    target?: InvitationTarget,
  ) {
    super(context, entity)
    this.agentMembership = context.agentMembership
    this.targetType = targetType
    this.target = target
  }

  canList(): boolean {
    return this.canManage()
  }

  canCreate(): boolean {
    return this.canManage()
  }

  canDelete(): boolean {
    return this.canManage()
  }

  private canManage(): boolean {
    switch (this.targetType) {
      case "agent":
        return this.canManageAgentInvitations()
      case "review_campaign":
        return this.canManageReviewCampaignInvitations()
      default:
        return this.canManageProjectInvitations()
    }
  }

  /**
   * Mirrors ReviewCampaignPolicy.canUpdate(): project admin/owner + resource belongs to scope.
   */
  private canManageProjectInvitations(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() && this.targetBelongsToScope()
  }

  /**
   * Mirrors AgentPolicy.canUpdate(): agent admin/owner + resource belongs to scope.
   * Uses canAccess() + targetBelongsToScope() because `entity` here is the Invitation
   * (or undefined), not the Agent itself.
   */
  private canManageAgentInvitations(): boolean {
    return (
      this.canAccess() &&
      this.targetBelongsToScope() &&
      this.isAgentAdminOrOwner() &&
      this.canAccessAgent()
    )
  }

  /**
   * Mirrors ReviewCampaignPolicy.canUpdate(): project admin/owner + resource belongs to scope.
   */
  private canManageReviewCampaignInvitations(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() && this.targetBelongsToScope()
  }

  private isAgentAdminOrOwner(): boolean {
    return this.agentMembership?.role === "admin" || this.agentMembership?.role === "owner"
  }

  private canAccessAgent(): boolean {
    if (!this.target || !this.agentMembership) return false
    return this.agentMembership.agentId === this.target.id
  }

  /**
   * Checks that the target entity belongs to the org/project context.
   * Falls back to true when no target is loaded (e.g. canList without a specific resource).
   * `projectId` is optional: Project targets are the project itself and carry no nested projectId.
   */
  private targetBelongsToScope(): boolean {
    if (!this.target) return true
    const orgMatch = this.target.organizationId === this.project?.organizationId
    const projectMatch = !this.target.projectId || this.target.projectId === this.project?.id
    return orgMatch && projectMatch
  }
}

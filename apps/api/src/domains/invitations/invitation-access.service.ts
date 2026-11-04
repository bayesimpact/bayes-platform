import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { hasRole, type MembershipRole } from "@/domains/rbac/membership-roles"
import { PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import type { InvitationTargetType } from "./invitation.types"

/** Where an invitation gives access. Structural, so this domain does not import other domains' entities. */
export type InvitationAccessTarget = {
  targetType: InvitationTargetType
  targetId: string
  organizationId: string
  projectId: string
  /** `admin` or `member` on a project, the campaign role (tester or reviewer) on a campaign. */
  role: string
  /** The agents a project invitation for a member also gives. Empty for other targets. */
  agentIds: string[]
}

/** What a person in the workspace holds: their highest workspace role and their agents. */
export type WorkspaceAccess = {
  email: string
  workspaceRoleKey: string
  agentIds: string[]
}

/** Reads and creates the memberships an accepted invitation stands for. */
@Injectable()
export class InvitationAccessService {
  constructor(
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly reviewCampaignMembershipsService: ReviewCampaignMembershipsService,
  ) {}

  /**
   * What the user holds on the workspace and on the agents given, or null when they are not in
   * the workspace. Only a member role counts on an agent.
   */
  async findWorkspaceAccess(params: {
    userId: string
    projectId: string
    agentIds: string[]
  }): Promise<Omit<WorkspaceAccess, "email"> | null> {
    const membership = await this.projectMembershipsService.findProjectMembership({
      userId: params.userId,
      projectId: params.projectId,
    })
    if (!membership) return null
    const agentMemberships = await this.agentMembershipsService.listUserAgentMemberships({
      userId: params.userId,
      agentIds: params.agentIds,
    })
    return {
      workspaceRoleKey: highestWorkspaceRoleKey(membership),
      agentIds: agentMemberships.map((agentMembership) => agentMembership.agentId),
    }
  }

  /** What each person in the workspace holds, among the agents given. */
  async listWorkspaceAccess(params: {
    projectId: string
    agentIds: string[]
  }): Promise<WorkspaceAccess[]> {
    const memberships = await this.projectMembershipsService.listProjectMemberships(
      params.projectId,
    )
    const agentMemberships = await this.agentMembershipsService.listMembershipsByAgentIds(
      params.agentIds,
    )
    return memberships.map((membership) => ({
      email: membership.user.email,
      workspaceRoleKey: highestWorkspaceRoleKey(membership),
      agentIds: agentMemberships
        .filter((agentMembership) => agentMembership.userId === membership.userId)
        .map((agentMembership) => agentMembership.agentId),
    }))
  }

  /** Gives a person already in the workspace a member role on each agent. Call inside a transaction. */
  async grantAgents(params: { userId: string; agentIds: string[] }): Promise<void> {
    for (const agentId of params.agentIds) {
      await this.agentMembershipsService.upsertAgentMemberMembership({
        userId: params.userId,
        agentId,
        role: "member",
      })
    }
  }

  /**
   * Whether the user already holds what an agent or campaign invitation would give. On an agent,
   * only a member role counts: a conversation reviewer grant alone does not. A workspace
   * invitation goes through `findWorkspaceAccess`, which also tells which agents are missing.
   */
  async hasAccess(params: { target: InvitationAccessTarget; userId: string }): Promise<boolean> {
    const { target, userId } = params
    switch (target.targetType) {
      case "project":
        throw new Error("A workspace invitation checks access with findWorkspaceAccess")
      case "agent":
        return Boolean(
          await this.agentMembershipsService.findAgentMembership({
            agentId: target.targetId,
            userId,
          }),
        )
      case "review_campaign": {
        const membership = await this.reviewCampaignMembershipsService.findByUserCampaignAndRole({
          userId,
          campaignId: target.targetId,
          role: target.role as ReviewCampaignMembershipRole,
        })
        return Boolean(membership)
      }
    }
  }

  /** Call inside a transaction. Does nothing for a membership that already exists. */
  async grant(params: { target: InvitationAccessTarget; userId: string }): Promise<void> {
    const { target, userId } = params
    switch (target.targetType) {
      case "project":
        if (target.role === "member") {
          await this.organizationMembershipsService.upsertOrganizationMemberMembership({
            userId,
            organizationId: target.organizationId,
          })
          await this.projectMembershipsService.upsertProjectMemberMembership({
            userId,
            projectId: target.targetId,
          })
          await this.grantAgents({ userId, agentIds: target.agentIds })
          return
        }
        // Project admins are organization admins and admins of every agent, as before.
        await this.organizationMembershipsService.upsertOrganizationAdminMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.projectMembershipsService.upsertProjectAdminMembership({
          userId,
          projectId: target.targetId,
        })
        return
      case "agent":
        await this.organizationMembershipsService.upsertOrganizationMemberMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.projectMembershipsService.upsertProjectMemberMembership({
          userId,
          projectId: target.projectId,
        })
        await this.agentMembershipsService.upsertAgentMemberMembership({
          userId,
          agentId: target.targetId,
          role: "member",
        })
        return
      case "review_campaign":
        // No project role: the campaign role gives what the person needs on the project
        // (PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN). The organization row stays, since every
        // organization-scoped route requires one.
        await this.organizationMembershipsService.upsertOrganizationMemberMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.reviewCampaignMembershipsService.acceptCampaignMembership({
          campaignId: target.targetId,
          userId,
          role: target.role as ReviewCampaignMembershipRole,
          organizationId: target.organizationId,
          projectId: target.projectId,
        })
        return
    }
  }
}

function highestWorkspaceRoleKey(membership: { roles: MembershipRole[] }): string {
  if (hasRole(membership, PROJECT_ROLES.owner)) return PROJECT_ROLES.owner
  if (hasRole(membership, PROJECT_ROLES.admin)) return PROJECT_ROLES.admin
  return PROJECT_ROLES.member
}

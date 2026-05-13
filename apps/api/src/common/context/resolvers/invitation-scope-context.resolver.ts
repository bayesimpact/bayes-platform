import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { Invitation, type InvitationTargetType } from "@/domains/invitations/invitation.entity"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithInvitationScope } from "../request.interface"

type InvitationScope = {
  organizationId: string
  projectId: string
  targetType: InvitationTargetType
  targetId: string
}

@Injectable()
export class InvitationScopeContextResolver implements ContextResolver {
  readonly resource = "invitationScope" as const

  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(AgentMembership)
    private readonly agentMembershipRepository: Repository<AgentMembership>,
    @InjectRepository(ReviewCampaign)
    private readonly reviewCampaignRepository: Repository<ReviewCampaign>,
    @InjectRepository(OrganizationMembership)
    private readonly organizationMembershipRepository: Repository<OrganizationMembership>,
    @InjectRepository(ProjectMembership)
    private readonly projectMembershipRepository: Repository<ProjectMembership>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const typedRequest = request as EndpointRequestWithInvitationScope & {
      body?: { payload?: { targetType?: string; targetId?: string } }
      query?: Record<string, string | undefined>
      params?: { invitationId?: string }
    }

    const scope = await this.resolveScope(typedRequest)

    const project = await this.projectRepository.findOne({
      where: { id: scope.projectId, organizationId: scope.organizationId },
    })
    if (!project) {
      throw new NotFoundException()
    }

    const organizationMembership = await this.organizationMembershipRepository.findOne({
      where: { userId: request.user.id, organizationId: scope.organizationId },
    })
    if (!organizationMembership) {
      throw new ForbiddenException("You do not have access to this organization")
    }

    const projectMembership =
      (await this.projectMembershipRepository.findOne({
        where: { userId: request.user.id, projectId: scope.projectId },
      })) ?? undefined

    typedRequest.organizationId = scope.organizationId
    typedRequest.organizationMembership = organizationMembership
    typedRequest.project = project
    typedRequest.projectMembership = projectMembership

    const target = await this.loadTarget(scope)
    typedRequest.invitationTarget = target

    if (scope.targetType === "agent") {
      typedRequest.invitationAgentMembership =
        (await this.agentMembershipRepository.findOne({
          where: { agentId: scope.targetId, userId: request.user.id },
        })) ?? undefined
    }
  }

  private async resolveScope(
    request: EndpointRequestWithInvitationScope & {
      body?: { payload?: { targetType?: string; targetId?: string } }
      query?: Record<string, string | undefined>
      params?: { invitationId?: string }
    },
  ): Promise<InvitationScope> {
    const invitationId = request.params?.invitationId
    if (invitationId) {
      const invitation = await this.invitationRepository.findOne({
        where: { id: invitationId, status: "pending" },
      })
      if (!invitation) {
        throw new NotFoundException(`Pending invitation ${invitationId} not found`)
      }
      request.invitation = invitation
      return {
        organizationId: invitation.organizationId,
        projectId: invitation.projectId,
        targetType: invitation.targetType,
        targetId: invitation.targetId,
      }
    }

    const targetType = request.body?.payload?.targetType ?? request.query?.targetType
    const targetId = request.body?.payload?.targetId ?? request.query?.targetId
    if (!targetType || !targetId) {
      throw new BadRequestException("targetType and targetId query parameters are required")
    }
    if (!this.isInvitationTargetType(targetType)) {
      throw new BadRequestException(`Invalid targetType: ${targetType}`)
    }

    const { organizationId, projectId } = await this.resolveOrgAndProject(targetType, targetId)
    return { organizationId, projectId, targetType, targetId }
  }

  private async loadTarget(scope: InvitationScope): Promise<Project | Agent | ReviewCampaign> {
    if (scope.targetType === "project") {
      const project = await this.projectRepository.findOne({ where: { id: scope.targetId } })
      if (!project) throw new NotFoundException(`Project ${scope.targetId} not found`)
      return project
    }

    if (scope.targetType === "agent") {
      const agent = await this.agentRepository.findOne({ where: { id: scope.targetId } })
      if (!agent) throw new NotFoundException(`Agent ${scope.targetId} not found`)
      return agent
    }

    const reviewCampaign = await this.reviewCampaignRepository.findOne({
      where: { id: scope.targetId },
    })
    if (!reviewCampaign) throw new NotFoundException(`Review campaign ${scope.targetId} not found`)
    return reviewCampaign
  }

  private async resolveOrgAndProject(
    targetType: InvitationTargetType,
    targetId: string,
  ): Promise<{ organizationId: string; projectId: string }> {
    if (targetType === "project") {
      const project = await this.projectRepository.findOne({ where: { id: targetId } })
      if (!project) throw new NotFoundException(`Project ${targetId} not found`)
      return { organizationId: project.organizationId, projectId: project.id }
    }

    if (targetType === "agent") {
      const agent = await this.agentRepository.findOne({ where: { id: targetId } })
      if (!agent) throw new NotFoundException(`Agent ${targetId} not found`)
      return { organizationId: agent.organizationId, projectId: agent.projectId }
    }

    const reviewCampaign = await this.reviewCampaignRepository.findOne({ where: { id: targetId } })
    if (!reviewCampaign) throw new NotFoundException(`Review campaign ${targetId} not found`)
    return { organizationId: reviewCampaign.organizationId, projectId: reviewCampaign.projectId }
  }

  private isInvitationTargetType(targetType: string): targetType is InvitationTargetType {
    return targetType === "project" || targetType === "agent" || targetType === "review_campaign"
  }
}

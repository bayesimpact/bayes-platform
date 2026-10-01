import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationRepository } from "@/domains/invitations/invitation.repository"
import {
  type InvitationTargetType,
  isInvitationTargetType,
} from "@/domains/invitations/invitation.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
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

type InvitationRequest = EndpointRequestWithInvitationScope & {
  body?: { payload?: { targetType?: string; targetId?: string } }
  query?: Record<string, string | undefined>
  params?: { invitationId?: string }
}

/**
 * Loads the project context and the target (project, agent or review
 * campaign) of an invitation. The target comes from the pending invitation
 * named by the `invitationId` route param, or else from `targetType` and
 * `targetId` in the payload or the query.
 */
@Injectable()
export class InvitationScopeContextResolver implements ContextResolver {
  readonly resource = "invitationScope" as const

  constructor(
    private readonly invitationRepository: InvitationRepository,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(ReviewCampaign)
    private readonly reviewCampaignRepository: Repository<ReviewCampaign>,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const typedRequest = request as InvitationRequest
    const { scope, target } = await this.resolveScopeAndTarget(typedRequest)

    const project = await this.projectRepository.findOne({
      where: { id: scope.projectId, organizationId: scope.organizationId },
    })
    if (!project) {
      throw new NotFoundException()
    }

    const organizationMembership =
      await this.organizationMembershipsService.findOrganizationMembership({
        userId: request.user.id,
        organizationId: scope.organizationId,
      })
    if (!organizationMembership) {
      throw new ForbiddenException("You do not have access to this organization")
    }

    typedRequest.organizationId = scope.organizationId
    typedRequest.organizationMembership = organizationMembership
    typedRequest.project = project
    typedRequest.projectMembership =
      (await this.projectMembershipsService.findProjectMembership({
        userId: request.user.id,
        projectId: scope.projectId,
      })) ?? undefined
    typedRequest.invitationTarget = target

    if (scope.targetType === "agent") {
      typedRequest.invitationAgentMembership =
        (await this.agentMembershipsService.findAgentMembership({
          agentId: scope.targetId,
          userId: request.user.id,
        })) ?? undefined
    }
  }

  private async resolveScopeAndTarget(
    request: InvitationRequest,
  ): Promise<{ scope: InvitationScope; target: Project | Agent | ReviewCampaign }> {
    const invitationId = request.params?.invitationId
    if (invitationId) {
      const invitation = await this.invitationRepository.findPendingById(invitationId)
      if (!invitation) {
        throw new NotFoundException(`Pending invitation ${invitationId} not found`)
      }
      request.invitation = invitation
    }

    const targetType =
      request.invitation?.targetType ??
      request.body?.payload?.targetType ??
      request.query?.targetType
    const targetId =
      request.invitation?.targetId ?? request.body?.payload?.targetId ?? request.query?.targetId
    if (!targetType || !targetId) {
      throw new BadRequestException("targetType and targetId are required")
    }
    if (!isInvitationTargetType(targetType)) {
      throw new BadRequestException(`Invalid targetType: ${targetType}`)
    }

    if (targetType === "project") {
      const project = await this.projectRepository.findOne({ where: { id: targetId } })
      if (!project) throw new NotFoundException(`Project ${targetId} not found`)
      return {
        scope: {
          organizationId: project.organizationId,
          projectId: project.id,
          targetType,
          targetId,
        },
        target: project,
      }
    }

    if (targetType === "agent") {
      const agent = await this.agentRepository.findOne({ where: { id: targetId } })
      if (!agent) throw new NotFoundException(`Agent ${targetId} not found`)
      return {
        scope: {
          organizationId: agent.organizationId,
          projectId: agent.projectId,
          targetType,
          targetId,
        },
        target: agent,
      }
    }

    const reviewCampaign = await this.reviewCampaignRepository.findOne({ where: { id: targetId } })
    if (!reviewCampaign) throw new NotFoundException(`Review campaign ${targetId} not found`)
    return {
      scope: {
        organizationId: reviewCampaign.organizationId,
        projectId: reviewCampaign.projectId,
        targetType,
        targetId,
      },
      target: reviewCampaign,
    }
  }
}

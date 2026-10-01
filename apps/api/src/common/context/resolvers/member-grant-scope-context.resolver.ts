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
import {
  isMemberGrantTargetType,
  type MemberGrantTargetType,
} from "@/domains/member-grants/member-grant.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { Project } from "@/domains/projects/project.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithMemberGrantScope } from "../request.interface"

type MemberGrantScope = {
  organizationId: string
  projectId: string
  targetType: MemberGrantTargetType
  targetId: string
}

type MemberGrantRequest = EndpointRequestWithMemberGrantScope & {
  body?: { payload?: { targetType?: string; targetId?: string } }
}

/**
 * Loads the project context and the target (project, agent or review
 * campaign) a member grant applies to, from `payload.targetType` and
 * `payload.targetId`.
 */
@Injectable()
export class MemberGrantScopeContextResolver implements ContextResolver {
  readonly resource = "memberGrantScope" as const

  constructor(
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
    const typedRequest = request as MemberGrantRequest
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
    typedRequest.memberGrantTarget = target

    if (scope.targetType === "agent") {
      typedRequest.memberGrantAgentMembership =
        (await this.agentMembershipsService.findAgentMembership({
          agentId: scope.targetId,
          userId: request.user.id,
        })) ?? undefined
    }
  }

  private async resolveScopeAndTarget(
    request: MemberGrantRequest,
  ): Promise<{ scope: MemberGrantScope; target: Project | Agent | ReviewCampaign }> {
    const targetType = request.body?.payload?.targetType
    const targetId = request.body?.payload?.targetId
    if (!targetType || !targetId) {
      throw new BadRequestException("targetType and targetId are required")
    }
    if (!isMemberGrantTargetType(targetType)) {
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

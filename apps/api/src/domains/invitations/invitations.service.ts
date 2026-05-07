import type { InvitationDto, InvitationTargetTypeDto } from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Auth0UserInfoService } from "@/domains/auth/auth0-userinfo.service"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentInvitationHandler } from "./handlers/agent-invitation.handler"
import type { InvitationAcceptanceHandler } from "./handlers/invitation-acceptance.handler"
import type { InvitationTargetHandler } from "./handlers/invitation-target.handler"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectInvitationHandler } from "./handlers/project-invitation.handler"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignInvitationHandler } from "./handlers/review-campaign-invitation.handler"
import { Invitation } from "./invitation.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationPersistenceService } from "./invitation-persistence.service"

type BaseInvitationNameMaps = {
  organizationNameById: Map<string, string>
  projectNameById: Map<string, string>
}

const TARGET_TYPES: InvitationTargetTypeDto[] = ["project", "agent", "review_campaign"]

function isInvitationTargetType(value: string): value is InvitationTargetTypeDto {
  return TARGET_TYPES.includes(value as InvitationTargetTypeDto)
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(OrganizationMembership)
    private readonly organizationMembershipRepository: Repository<OrganizationMembership>,
    @InjectRepository(ProjectMembership)
    private readonly projectMembershipRepository: Repository<ProjectMembership>,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly auth0UserInfoService: Auth0UserInfoService,
    private readonly projectInvitationHandler: ProjectInvitationHandler,
    private readonly agentInvitationHandler: AgentInvitationHandler,
    private readonly reviewCampaignInvitationHandler: ReviewCampaignInvitationHandler,
  ) {}

  async listPendingMine(params: { userId: string; userEmail: string }): Promise<InvitationDto[]> {
    const normalizedEmail = params.userEmail.trim().toLowerCase()
    const invitations = await this.invitationRepository.find({
      where: [
        { userId: params.userId, status: "pending" },
        { invitedEmail: normalizedEmail, status: "pending" },
      ],
      order: { invitedAt: "DESC" },
    })
    return this.toDtos(invitations)
  }

  async inviteProjectMembers(params: {
    projectId: string
    emails: string[]
    inviterName: string
  }): Promise<Invitation[]> {
    return this.projectInvitationHandler.inviteMembers(params)
  }

  async inviteAgentMembers(params: {
    agentId: string
    emails: string[]
    inviterName: string
  }): Promise<Invitation[]> {
    return this.agentInvitationHandler.inviteMembers(params)
  }

  async inviteReviewCampaignMembers(params: {
    reviewCampaignId: string
    emails: string[]
    role: ReviewCampaignMembershipRole
    inviterName: string
  }): Promise<Invitation[]> {
    return this.reviewCampaignInvitationHandler.inviteMembers(params)
  }

  async listForTarget(params: {
    userId: string
    targetType: string
    targetId: string
  }): Promise<InvitationDto[]> {
    const { targetType, targetId, userId } = params
    if (!isInvitationTargetType(targetType)) {
      throw new BadRequestException(`Invalid targetType: ${targetType}`)
    }

    const scope = await this.resolveTargetScope(targetType, targetId)
    await this.assertUserCanManageInvitations({ userId, ...scope })

    const invitations = await this.invitationRepository.find({
      where: { targetType, targetId, status: "pending" },
      order: { invitedAt: "DESC" },
    })
    return this.toDtos(invitations)
  }

  private async resolveTargetScope(
    targetType: InvitationTargetTypeDto,
    targetId: string,
  ): Promise<{ organizationId: string; projectId: string }> {
    return this.getTargetHandler(targetType).resolveScope(targetId)
  }

  private async assertUserCanManageInvitations(params: {
    userId: string
    organizationId: string
    projectId: string
  }): Promise<void> {
    const { userId, organizationId, projectId } = params
    const organizationMembership = await this.organizationMembershipRepository.findOne({
      where: { userId, organizationId },
    })
    if (!organizationMembership) {
      throw new ForbiddenException("You do not have access to this organization")
    }

    const projectMembership = await this.projectMembershipRepository.findOne({
      where: { userId, projectId },
    })
    if (!projectMembership) {
      throw new ForbiddenException("You do not have access to this project")
    }

    if (projectMembership.role !== "owner" && projectMembership.role !== "admin") {
      throw new ForbiddenException("You must be a project owner or admin to list invitations")
    }
  }

  private async toDtos(invitations: Invitation[]): Promise<InvitationDto[]> {
    if (invitations.length === 0) return []

    const baseNameMaps = await this.buildBaseInvitationNameMaps(invitations)
    const targetNameByInvitationId = await this.resolveTargetNameByInvitationId(invitations)
    return invitations.map((invitation) =>
      this.toDto(invitation, baseNameMaps, targetNameByInvitationId),
    )
  }

  private async buildBaseInvitationNameMaps(
    invitations: Invitation[],
  ): Promise<BaseInvitationNameMaps> {
    const organizationIds = [...new Set(invitations.map((invitation) => invitation.organizationId))]
    const projectIds = [...new Set(invitations.map((invitation) => invitation.projectId))]

    const [organizations, projects] = await Promise.all([
      this.organizationRepository.find({
        where: { id: In(organizationIds) },
        select: { id: true, name: true },
      }),
      this.projectRepository.find({
        where: { id: In(projectIds) },
        select: { id: true, name: true },
      }),
    ])

    return {
      organizationNameById: new Map(
        organizations.map((organization) => [organization.id, organization.name]),
      ),
      projectNameById: new Map(projects.map((project) => [project.id, project.name])),
    }
  }

  private async resolveTargetNameByInvitationId(
    invitations: Invitation[],
  ): Promise<Map<string, string>> {
    const targetNameByInvitationId = new Map<string, string>()
    await Promise.all(
      TARGET_TYPES.map(async (targetType) => {
        const invitationsForTargetType = invitations.filter(
          (invitation) => invitation.targetType === targetType,
        )
        if (invitationsForTargetType.length === 0) return
        const names =
          await this.getTargetHandler(targetType).resolveTargetNameByInvitationId(
            invitationsForTargetType,
          )
        for (const [invitationId, targetName] of names.entries()) {
          targetNameByInvitationId.set(invitationId, targetName)
        }
      }),
    )
    return targetNameByInvitationId
  }

  private getTargetHandler(targetType: InvitationTargetTypeDto): InvitationTargetHandler {
    if (targetType === "project") return this.projectInvitationHandler
    if (targetType === "agent") return this.agentInvitationHandler
    return this.reviewCampaignInvitationHandler
  }

  private toDto(
    invitation: Invitation,
    baseNameMaps: BaseInvitationNameMaps,
    targetNameByInvitationId: Map<string, string>,
  ): InvitationDto {
    const organizationName = baseNameMaps.organizationNameById.get(invitation.organizationId) ?? ""
    const projectName = baseNameMaps.projectNameById.get(invitation.projectId) ?? ""
    const targetName =
      invitation.targetType === "project"
        ? projectName
        : (targetNameByInvitationId.get(invitation.id) ?? "")

    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      projectId: invitation.projectId,
      targetType: invitation.targetType,
      targetId: invitation.targetId,
      userId: invitation.userId,
      invitedEmail: invitation.invitedEmail,
      role: invitation.role,
      invitationToken: invitation.invitationToken,
      status: invitation.status,
      invitedAt: invitation.invitedAt.getTime(),
      acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.getTime() : null,
      organizationName,
      projectName,
      targetName,
    }
  }

  private async resolveAcceptanceHandler(ticketId: string): Promise<InvitationAcceptanceHandler> {
    const acceptanceHandlers = this.getAcceptanceHandlers()
    for (const acceptanceHandler of acceptanceHandlers) {
      if (await acceptanceHandler.canHandle(ticketId)) {
        return acceptanceHandler
      }
    }
    throw new NotFoundException(`No invitation found for ticket: ${ticketId}`)
  }

  private getAcceptanceHandlers(): InvitationAcceptanceHandler[] {
    return [
      this.agentInvitationHandler,
      this.projectInvitationHandler,
      this.reviewCampaignInvitationHandler,
    ]
  }

  async acceptInvitation({
    ticketId,
    accessToken,
    auth0Sub,
  }: {
    accessToken: string
    ticketId: string
    auth0Sub: string
  }): Promise<{ type: "agent" | "project" | "reviewCampaign"; userId: string }> {
    const acceptanceHandler = await this.resolveAcceptanceHandler(ticketId)

    const { email } = await this.auth0UserInfoService.getUserInfo(accessToken)
    if (!email) throw new NotFoundException(`No email found for auth0Sub: ${auth0Sub}`)

    const accepted = await acceptanceHandler.acceptInvitation({ ticketId, auth0Sub, email })

    await this.invitationPersistence.markAcceptedByToken(ticketId)

    return { type: acceptanceHandler.acceptanceType, userId: accepted.userId }
  }
}

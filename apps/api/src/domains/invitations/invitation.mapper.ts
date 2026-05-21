import type { InvitationDto } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { Organization } from "@/domains/organizations/organization.entity"
import { Project } from "@/domains/projects/project.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentInvitationHandler } from "./handlers/agent-invitation.handler"
import type { InvitationTargetHandler } from "./handlers/invitation-target.handler"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectInvitationHandler } from "./handlers/project-invitation.handler"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignInvitationHandler } from "./handlers/review-campaign-invitation.handler"
import type { Invitation } from "./invitation.entity"

type BaseInvitationNameMaps = {
  organizationNameById: Map<string, string>
  projectNameById: Map<string, string>
}

@Injectable()
export class InvitationMapper {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly projectInvitationHandler: ProjectInvitationHandler,
    private readonly agentInvitationHandler: AgentInvitationHandler,
    private readonly reviewCampaignInvitationHandler: ReviewCampaignInvitationHandler,
  ) {}

  async toDtos(invitations: Invitation[]): Promise<InvitationDto[]> {
    if (invitations.length === 0) return []

    const baseNameMaps = await this.buildBaseNameMaps(invitations)
    const targetNameByInvitationId = await this.resolveTargetNameByInvitationId(invitations)
    return invitations.map((invitation) =>
      this.toDto(invitation, baseNameMaps, targetNameByInvitationId),
    )
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

  private async buildBaseNameMaps(invitations: Invitation[]): Promise<BaseInvitationNameMaps> {
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
      this.getTargetHandlers().map(async (targetHandler) => {
        const invitationsForTargetType = invitations.filter(
          (invitation) => invitation.targetType === targetHandler.targetType,
        )
        if (invitationsForTargetType.length === 0) return
        const names = await targetHandler.resolveTargetNameByInvitationId(invitationsForTargetType)
        for (const [invitationId, targetName] of names.entries()) {
          targetNameByInvitationId.set(invitationId, targetName)
        }
      }),
    )
    return targetNameByInvitationId
  }

  private getTargetHandlers(): InvitationTargetHandler[] {
    return [
      this.projectInvitationHandler,
      this.agentInvitationHandler,
      this.reviewCampaignInvitationHandler,
    ]
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Auth0UserInfoService } from "@/domains/auth/auth0-userinfo.service"
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

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    private readonly invitationPersistence: InvitationPersistenceService,
    private readonly auth0UserInfoService: Auth0UserInfoService,
    private readonly projectInvitationHandler: ProjectInvitationHandler,
    private readonly agentInvitationHandler: AgentInvitationHandler,
    private readonly reviewCampaignInvitationHandler: ReviewCampaignInvitationHandler,
  ) {}

  async listPendingMine(params: { userId: string; userEmail: string }): Promise<Invitation[]> {
    const normalizedEmail = params.userEmail.trim().toLowerCase()
    return this.invitationRepository.find({
      where: [
        { userId: params.userId, status: "pending" },
        { invitedEmail: normalizedEmail, status: "pending" },
      ],
      order: { invitedAt: "DESC" },
    })
  }

  async createForTarget(params: {
    targetType: string
    targetId: string
    emails: string[]
    role?: string
    inviterName: string
  }): Promise<Invitation[]> {
    const { targetType, targetId } = params
    const targetHandler = this.getTargetHandler(targetType)
    return targetHandler.createInvitations({
      targetId,
      emails: params.emails,
      role: params.role,
      inviterName: params.inviterName,
    })
  }

  async listForTarget(params: { targetType: string; targetId: string }): Promise<Invitation[]> {
    const { targetType, targetId } = params
    const targetHandler = this.getTargetHandler(targetType)
    return this.invitationRepository.find({
      where: { targetType: targetHandler.targetType, targetId, status: "pending" },
      order: { invitedAt: "DESC" },
    })
  }

  async revokeOne(params: { invitationId: string }): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: params.invitationId },
    })
    if (!invitation) {
      throw new NotFoundException(`Invitation ${params.invitationId} not found`)
    }
    if (invitation.status !== "pending") {
      throw new ConflictException(
        `Cannot revoke an invitation that has already been ${invitation.status}`,
      )
    }
    await this.invitationRepository.update({ id: invitation.id }, { status: "revoked" })
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

  private getTargetHandler(targetType: string): InvitationTargetHandler {
    const targetHandler = this.getTargetHandlers().find(
      (handler) => handler.targetType === targetType,
    )
    if (!targetHandler) {
      throw new BadRequestException(`Invalid targetType: ${targetType}`)
    }
    return targetHandler
  }

  private getTargetHandlers(): InvitationTargetHandler[] {
    return [
      this.projectInvitationHandler,
      this.agentInvitationHandler,
      this.reviewCampaignInvitationHandler,
    ]
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
}

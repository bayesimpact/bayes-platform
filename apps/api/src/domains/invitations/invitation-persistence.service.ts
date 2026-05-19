import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { EntityManager, Repository } from "typeorm"
import { Invitation } from "./invitation.entity"

@Injectable()
export class InvitationPersistenceService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
  ) {}

  private repo(manager?: EntityManager): Repository<Invitation> {
    return manager ? manager.getRepository(Invitation) : this.invitationRepository
  }

  async createPendingProjectInvitation(
    params: {
      organizationId: string
      projectId: string
      userId: string | null
      invitedEmail: string | null
      invitationToken: string
      role: string
      invitedAt?: Date
    },
    manager?: EntityManager,
  ): Promise<Invitation> {
    const invitation = this.repo(manager).create({
      organizationId: params.organizationId,
      projectId: params.projectId,
      targetType: "project",
      targetId: params.projectId,
      userId: params.userId,
      invitedEmail: params.invitedEmail,
      invitationToken: params.invitationToken,
      status: "pending",
      role: params.role,
      invitedAt: params.invitedAt ?? new Date(),
      acceptedAt: null,
    })
    return this.repo(manager).save(invitation)
  }

  async createPendingAgentInvitation(
    params: {
      organizationId: string
      projectId: string
      agentId: string
      userId: string | null
      invitedEmail: string | null
      invitationToken: string
      role: string
      invitedAt?: Date
    },
    manager?: EntityManager,
  ): Promise<Invitation> {
    const invitation = this.repo(manager).create({
      organizationId: params.organizationId,
      projectId: params.projectId,
      targetType: "agent",
      targetId: params.agentId,
      userId: params.userId,
      invitedEmail: params.invitedEmail,
      invitationToken: params.invitationToken,
      status: "pending",
      role: params.role,
      invitedAt: params.invitedAt ?? new Date(),
      acceptedAt: null,
    })
    return this.repo(manager).save(invitation)
  }

  async createPendingReviewCampaignInvitation(
    params: {
      organizationId: string
      projectId: string
      campaignId: string
      userId: string | null
      invitedEmail: string | null
      invitationToken: string
      role: string
      invitedAt: Date
    },
    manager?: EntityManager,
  ): Promise<Invitation> {
    const invitation = this.repo(manager).create({
      organizationId: params.organizationId,
      projectId: params.projectId,
      targetType: "review_campaign",
      targetId: params.campaignId,
      userId: params.userId,
      invitedEmail: params.invitedEmail,
      invitationToken: params.invitationToken,
      status: "pending",
      role: params.role,
      invitedAt: params.invitedAt,
      acceptedAt: null,
    })
    return this.repo(manager).save(invitation)
  }

  async markAcceptedByToken(invitationToken: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update(
      { invitationToken },
      { status: "accepted", acceptedAt: new Date() },
    )
  }

  async softDeleteByInvitationToken(
    invitationToken: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).softDelete({ invitationToken })
  }
}

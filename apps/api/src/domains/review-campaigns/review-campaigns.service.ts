import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipsService } from "./memberships/review-campaign-memberships.service"
import { ReviewCampaign } from "./review-campaign.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignRepository } from "./review-campaign.repository"
import type { ReviewCampaignQuestion, ReviewCampaignStatus } from "./review-campaigns.types"
import type { CampaignAggregates } from "./tester/tester.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TesterService } from "./tester/tester.service"

export type CreateReviewCampaignFields = {
  agentId: string
  name: string
  description?: string | null
  testerPerSessionQuestions?: ReviewCampaignQuestion[]
  testerEndOfPhaseQuestions?: ReviewCampaignQuestion[]
  reviewerQuestions?: ReviewCampaignQuestion[]
}

export type UpdateReviewCampaignFields = {
  name?: string
  description?: string | null
  testerPerSessionQuestions?: ReviewCampaignQuestion[]
  testerEndOfPhaseQuestions?: ReviewCampaignQuestion[]
  reviewerQuestions?: ReviewCampaignQuestion[]
  status?: ReviewCampaignStatus
}

@Injectable()
export class ReviewCampaignsService {
  private readonly reviewCampaignConnectRepository: ConnectRepository<ReviewCampaign>

  constructor(
    @InjectRepository(ReviewCampaign)
    reviewCampaignOrmRepository: Repository<ReviewCampaign>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly reviewCampaignMembershipsService: ReviewCampaignMembershipsService,
    private readonly reviewCampaignRepository: ReviewCampaignRepository,
    private readonly testerService: TesterService,
  ) {
    this.reviewCampaignConnectRepository = new ConnectRepository(
      reviewCampaignOrmRepository,
      "review-campaigns",
    )
  }

  async createCampaign({
    connectScope,
    fields,
  }: {
    connectScope: RequiredConnectScope
    fields: CreateReviewCampaignFields
  }): Promise<ReviewCampaign> {
    if (!fields.name.trim()) {
      throw new UnprocessableEntityException("Campaign name is required")
    }

    const agent = await this.agentRepository.findOne({
      where: {
        id: fields.agentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
    if (!agent) {
      throw new UnprocessableEntityException(`Agent ${fields.agentId} not found in this project`)
    }

    return this.reviewCampaignConnectRepository.createAndSave(connectScope, {
      agentId: fields.agentId,
      name: fields.name.trim(),
      description: fields.description ?? null,
      status: "draft",
      testerPerSessionQuestions: fields.testerPerSessionQuestions ?? [],
      testerEndOfPhaseQuestions: fields.testerEndOfPhaseQuestions ?? [],
      reviewerQuestions: fields.reviewerQuestions ?? [],
      activatedAt: null,
      closedAt: null,
    })
  }

  async listCampaigns(
    connectScope: RequiredConnectScope,
  ): Promise<Array<{ campaign: ReviewCampaign; memberCount: number }>> {
    return this.reviewCampaignRepository.listWithMemberCounts(connectScope)
  }

  async findById({
    connectScope,
    reviewCampaignId,
  }: {
    connectScope: RequiredConnectScope
    reviewCampaignId: string
  }): Promise<ReviewCampaign | null> {
    return this.reviewCampaignConnectRepository.getOneById(connectScope, reviewCampaignId)
  }

  async getDetail({
    connectScope,
    reviewCampaignId,
  }: {
    connectScope: RequiredConnectScope
    reviewCampaignId: string
  }): Promise<{
    campaign: ReviewCampaign
    memberships: Awaited<ReturnType<ReviewCampaignMembershipsService["listCampaignMemberships"]>>
    aggregates: CampaignAggregates | null
  }> {
    const campaign = await this.findById({ connectScope, reviewCampaignId })
    if (!campaign) {
      throw new NotFoundException(`Review campaign ${reviewCampaignId} not found`)
    }
    const memberships = await this.reviewCampaignMembershipsService.listCampaignMemberships(
      campaign.id,
    )
    const aggregates =
      campaign.status === "closed"
        ? await this.testerService.computeCampaignAggregates(campaign.id)
        : null
    return { campaign, memberships, aggregates }
  }

  async updateCampaign({
    connectScope,
    reviewCampaignId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    reviewCampaignId: string
    fieldsToUpdate: UpdateReviewCampaignFields
  }): Promise<ReviewCampaign> {
    const campaign = await this.reviewCampaignConnectRepository.getOneById(
      connectScope,
      reviewCampaignId,
    )
    if (!campaign) {
      throw new NotFoundException(`Review campaign ${reviewCampaignId} not found`)
    }

    const { status, ...configUpdates } = fieldsToUpdate

    const isConfigEdit = Object.values(configUpdates).some((v) => v !== undefined)
    if (isConfigEdit && campaign.status !== "draft") {
      throw new ConflictException(
        "Campaign configuration can only be edited while the campaign is in draft",
      )
    }

    if (configUpdates.name !== undefined) {
      if (!configUpdates.name.trim()) {
        throw new UnprocessableEntityException("Campaign name is required")
      }
      campaign.name = configUpdates.name.trim()
    }
    if (configUpdates.description !== undefined) {
      campaign.description = configUpdates.description
    }
    if (configUpdates.testerPerSessionQuestions !== undefined) {
      campaign.testerPerSessionQuestions = configUpdates.testerPerSessionQuestions
    }
    if (configUpdates.testerEndOfPhaseQuestions !== undefined) {
      campaign.testerEndOfPhaseQuestions = configUpdates.testerEndOfPhaseQuestions
    }
    if (configUpdates.reviewerQuestions !== undefined) {
      campaign.reviewerQuestions = configUpdates.reviewerQuestions
    }

    if (status !== undefined && status !== campaign.status) {
      this.applyStatusTransition(campaign, status)
    }

    return this.reviewCampaignConnectRepository.saveOne(campaign)
  }

  private applyStatusTransition(campaign: ReviewCampaign, nextStatus: ReviewCampaignStatus): void {
    const now = new Date()
    if (campaign.status === "draft" && nextStatus === "active") {
      campaign.status = "active"
      campaign.activatedAt = now
      return
    }
    if (campaign.status === "active" && nextStatus === "closed") {
      campaign.status = "closed"
      campaign.closedAt = now
      return
    }
    throw new ConflictException(
      `Cannot transition campaign from ${campaign.status} to ${nextStatus}`,
    )
  }

  async deleteCampaign({
    connectScope,
    reviewCampaignId,
  }: {
    connectScope: RequiredConnectScope
    reviewCampaignId: string
  }): Promise<void> {
    const campaign = await this.reviewCampaignConnectRepository.getOneById(
      connectScope,
      reviewCampaignId,
    )
    if (!campaign) {
      throw new NotFoundException(`Review campaign ${reviewCampaignId} not found`)
    }
    if (campaign.status !== "draft") {
      throw new ConflictException("Only draft campaigns can be deleted")
    }

    await this.reviewCampaignConnectRepository.deleteOneById({
      connectScope,
      id: reviewCampaignId,
    })
  }

  async revokeMembership({
    connectScope,
    reviewCampaignId,
    membershipId,
  }: {
    connectScope: RequiredConnectScope
    reviewCampaignId: string
    membershipId: string
  }): Promise<void> {
    const campaign = await this.reviewCampaignConnectRepository.getOneById(
      connectScope,
      reviewCampaignId,
    )
    if (!campaign) {
      throw new NotFoundException(`Review campaign ${reviewCampaignId} not found`)
    }

    const membership = await this.reviewCampaignMembershipsService.findById({
      membershipId,
      campaignId: campaign.id,
    })
    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found in this campaign`)
    }
    if (campaign.status === "closed") {
      throw new ForbiddenException("Cannot revoke memberships from a closed campaign")
    }

    await this.reviewCampaignMembershipsService.removeCampaignMembership({
      membershipId,
      campaignId: campaign.id,
      userId: membership.userId,
      role: membership.role,
    })
  }
}

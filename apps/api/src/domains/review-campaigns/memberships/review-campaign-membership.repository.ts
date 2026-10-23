import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  getMembershipResourceId,
  UserMembership,
} from "@/domains/memberships/user-membership.entity"
import { REVIEW_CAMPAIGN_ROLES } from "@/domains/rbac/rbac.constants"
import { resolveReviewCampaignRoleId } from "@/domains/rbac/resolve-review-campaign-role-id"
import { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"
import type { ReviewCampaignMembershipModel } from "./review-campaign-membership.model"

const REVIEW_CAMPAIGN_RESOURCE_TYPE = "review_campaign" as const
const MEMBERSHIP_RELATIONS = { user: true, rbacRole: true } as const

const ROLE_BY_ROLE_KEY = new Map<string, ReviewCampaignMembershipRole>(
  Object.entries(REVIEW_CAMPAIGN_ROLES).map(([role, roleKey]) => [
    roleKey,
    role as ReviewCampaignMembershipRole,
  ]),
)

/** Matches the rows holding a campaign role, or the given one. A row without a role is ignored. */
function campaignRoleFilter(role?: ReviewCampaignMembershipRole) {
  return { key: role ? REVIEW_CAMPAIGN_ROLES[role] : In(Object.values(REVIEW_CAMPAIGN_ROLES)) }
}

/**
 * Repository for review-campaign memberships.
 *
 * Reads and writes the unified `user_membership` table with
 * `resourceType = 'review_campaign'`.
 *
 * A user may hold both `tester` and `reviewer` roles on the same campaign;
 * each role is a separate row, holding the matching `review_campaign_*` RBAC role. The model is
 * one row: its `role` is read from `role_id`.
 */
@Injectable()
export class ReviewCampaignMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findById({
    membershipId,
    campaignId,
  }: {
    membershipId: string
    campaignId: string
  }): Promise<ReviewCampaignMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        id: membershipId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        rbacRole: campaignRoleFilter(),
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    if (!membership) return null

    const campaign = await this.campaignRepo().findOne({ where: { id: campaignId } })
    if (!campaign) return null

    return this.toModel(membership, campaign)
  }

  async findByUserCampaignAndRole({
    userId,
    campaignId,
    role,
  }: {
    userId: string
    campaignId: string
    role: ReviewCampaignMembershipRole
  }): Promise<ReviewCampaignMembershipModel | null> {
    const membership = await this.userMembershipRepo().findOne({
      where: {
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        rbacRole: campaignRoleFilter(role),
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    if (!membership) return null

    const campaign = await this.campaignRepo().findOne({ where: { id: campaignId } })
    if (!campaign) return null

    return this.toModel(membership, campaign)
  }

  async findAllByCampaign(campaignId: string): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: {
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        rbacRole: campaignRoleFilter(),
      },
      relations: MEMBERSHIP_RELATIONS,
      order: { createdAt: "ASC" },
    })
    const campaign = await this.campaignRepo().findOneOrFail({ where: { id: campaignId } })
    return memberships.flatMap((membership) => this.toModel(membership, campaign) ?? [])
  }

  async findAllByUser(userId: string): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: {
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        rbacRole: campaignRoleFilter(),
      },
      relations: MEMBERSHIP_RELATIONS,
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async findAllByUserAndRole({
    userId,
    role,
  }: {
    userId: string
    role: ReviewCampaignMembershipRole
  }): Promise<ReviewCampaignMembershipModel[]> {
    const memberships = await this.userMembershipRepo().find({
      where: {
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        rbacRole: campaignRoleFilter(role),
      },
      relations: { rbacRole: true },
      order: { createdAt: "DESC" },
    })
    return this.toModels(memberships)
  }

  async acceptMembership({
    campaignId,
    userId,
    role,
    organizationId: _organizationId,
    projectId: _projectId,
  }: {
    campaignId: string
    userId: string
    role: ReviewCampaignMembershipRole
    organizationId: string
    projectId: string
  }): Promise<ReviewCampaignMembershipModel> {
    const existing = await this.findByUserCampaignAndRole({ userId, campaignId, role })
    if (existing) return existing

    const roleId = await resolveReviewCampaignRoleId(this.transactionService.getManager(), role)
    if (!roleId) {
      throw new Error(`Role ${REVIEW_CAMPAIGN_ROLES[role]} not found: is the RBAC catalog seeded?`)
    }
    await this.userMembershipRepo()
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
        resourceId: campaignId,
        roleId,
      })
      .orIgnore()
      .execute()

    const created = await this.findByUserCampaignAndRole({ userId, campaignId, role })
    if (!created) throw new Error(`Review campaign ${campaignId} not found`)
    return created
  }

  async deleteMembership({
    membershipId,
    campaignId,
    userId,
    role,
  }: {
    membershipId: string
    campaignId: string
    userId: string
    role: ReviewCampaignMembershipRole
  }): Promise<void> {
    await this.transactionService.getManager().query(
      `DELETE FROM user_membership AS membership
       USING role
       WHERE membership.id = $1
         AND membership.user_id = $2
         AND membership.resource_type = $3
         AND membership.resource_id = $4
         AND role.id = membership.role_id
         AND role.key = $5`,
      [
        membershipId,
        userId,
        REVIEW_CAMPAIGN_RESOURCE_TYPE,
        campaignId,
        REVIEW_CAMPAIGN_ROLES[role],
      ],
    )
  }

  async softDeleteAllByCampaign(campaignId: string): Promise<void> {
    await this.userMembershipRepo().softDelete({
      resourceType: REVIEW_CAMPAIGN_RESOURCE_TYPE,
      resourceId: campaignId,
    })
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private campaignRepo(): Repository<ReviewCampaign> {
    return this.transactionService.getManager().getRepository(ReviewCampaign)
  }

  private async toModels(memberships: UserMembership[]): Promise<ReviewCampaignMembershipModel[]> {
    if (memberships.length === 0) return []

    const campaignIds = [
      ...new Set(
        memberships
          .map((membership) => membership.resourceId)
          .filter((resourceId): resourceId is string => resourceId !== null),
      ),
    ]
    const campaigns = await this.campaignRepo().find({ where: { id: In(campaignIds) } })
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))

    return memberships.flatMap((membership) => {
      if (!membership.resourceId) {
        return []
      }
      const campaign = campaignById.get(membership.resourceId)
      return campaign ? (this.toModel(membership, campaign) ?? []) : []
    })
  }

  /** Null for a row that holds no campaign role. */
  private toModel(
    membership: UserMembership,
    campaign: ReviewCampaign,
  ): ReviewCampaignMembershipModel | null {
    const rbacRole = membership.rbacRole
    const role = rbacRole ? ROLE_BY_ROLE_KEY.get(rbacRole.key) : undefined
    if (!rbacRole || !role) return null

    return {
      id: membership.id,
      userId: membership.userId,
      campaignId: getMembershipResourceId(membership),
      organizationId: campaign.organizationId,
      projectId: campaign.projectId,
      role,
      membershipRole: {
        membershipId: membership.id,
        roleId: rbacRole.id,
        key: rbacRole.key,
        name: rbacRole.name,
        scopeType: rbacRole.scopeType,
      },
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      deletedAt: membership.deletedAt,
      user: membership.user,
      campaign,
    }
  }
}

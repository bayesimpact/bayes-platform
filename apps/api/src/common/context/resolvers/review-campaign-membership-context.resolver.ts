import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithReviewCampaign,
  EndpointRequestWithReviewCampaignMembership,
} from "../request.interface"

@Injectable()
export class ReviewCampaignMembershipContextResolver implements ContextResolver {
  readonly resource = "reviewCampaignMembership" as const

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithCampaign = request as EndpointRequestWithReviewCampaign
    const campaignId = requestWithCampaign.reviewCampaign.id

    // Load both role-memberships for (campaign, user). A user can hold tester
    // AND reviewer roles on the same campaign; each domain guard reads the
    // field matching its role.
    const userMemberships = await this.dataSource.getRepository(UserMembership).find({
      where: {
        userId: request.user.id,
        resourceId: campaignId,
        resourceType: "review_campaign",
      },
    })

    const testerRow = userMemberships.find((membership) => membership.role === "tester")
    const reviewerRow = userMemberships.find((membership) => membership.role === "reviewer")

    // TODO (cleanup PR): once ReviewCampaignMembership is removed, narrow the
    // request-interface types for testerMembership / reviewerMembership to a
    // Pick of only what policies actually read (campaignId today), drop the
    // `as` cast below, and load the `user` / `campaign` relations only if a
    // policy starts needing them.
    //
    // The `as ReviewCampaignMembership` below is intentional: we build a
    // plain DTO from user_membership rows rather than a real entity instance,
    // so the `campaign` and `user` relation fields are absent. TypeScript would
    // reject `satisfies ReviewCampaignMembership` because of those missing
    // fields. At runtime this is safe — no policy reads those relations; they
    // only check `!!membership` and `membership.campaignId`.
    const toReviewCampaignMembership = (
      row: UserMembership,
      role: "tester" | "reviewer",
    ): ReviewCampaignMembership =>
      ({
        id: row.id,
        userId: row.userId,
        campaignId,
        role,
        acceptedAt: null,
        organizationId: requestWithCampaign.reviewCampaign.organizationId,
        projectId: requestWithCampaign.reviewCampaign.projectId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      }) as ReviewCampaignMembership

    const requestWithMembership = request as EndpointRequestWithReviewCampaignMembership
    requestWithMembership.testerMembership = testerRow
      ? toReviewCampaignMembership(testerRow, "tester")
      : undefined
    requestWithMembership.reviewerMembership = reviewerRow
      ? toReviewCampaignMembership(reviewerRow, "reviewer")
      : undefined
  }
}

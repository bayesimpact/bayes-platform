import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipRepository } from "@/domains/review-campaigns/memberships/review-campaign-membership.repository"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithReviewCampaign,
  EndpointRequestWithReviewCampaignMembership,
} from "../request.interface"

@Injectable()
export class ReviewCampaignMembershipContextResolver implements ContextResolver {
  readonly resource = "reviewCampaignMembership" as const

  constructor(
    private readonly reviewCampaignMembershipRepository: ReviewCampaignMembershipRepository,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithCampaign = request as EndpointRequestWithReviewCampaign
    const campaignId = requestWithCampaign.reviewCampaign.id

    const memberships = await this.reviewCampaignMembershipRepository.findAllByUserAndCampaign({
      userId: request.user.id,
      campaignId,
    })

    const testerMembership = memberships.find((membership) => membership.role === "tester")
    const reviewerMembership = memberships.find((membership) => membership.role === "reviewer")

    const requestWithMembership = request as EndpointRequestWithReviewCampaignMembership
    requestWithMembership.testerMembership = testerMembership
    requestWithMembership.reviewerMembership = reviewerMembership
  }
}

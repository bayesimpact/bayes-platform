import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { AgentSessionReviewCampaignContextResolver } from "./resolvers/agent-session-review-campaign-context.resolver"

/**
 * Gives a module the `agentSessionReviewCampaign` context with the repository it needs, so a
 * module of another domain does not import the review campaign entity.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReviewCampaign])],
  providers: [AgentSessionReviewCampaignContextResolver],
  exports: [AgentSessionReviewCampaignContextResolver],
})
export class AgentSessionReviewCampaignContextModule {}

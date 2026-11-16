import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithAgentSession,
  EndpointRequestWithAgentSessionReviewCampaign,
} from "../request.interface"

/**
 * Puts the review campaign of the resolved agent session on the request, so a tester route checks
 * its permission on the session's own campaign. A check on the project would also count the
 * caller's other campaigns of that project.
 *
 * Runs after the `agentSession` context. Answers 404 for a session that belongs to no campaign.
 */
@Injectable()
export class AgentSessionReviewCampaignContextResolver implements ContextResolver {
  readonly resource = "agentSessionReviewCampaign" as const

  constructor(
    @InjectRepository(ReviewCampaign)
    private readonly reviewCampaignRepository: Repository<ReviewCampaign>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithAgentSession =
      request as EndpointRequestWithAgentSession<ConversationAgentSession>
    const { agentSession } = requestWithAgentSession
    if (!agentSession.campaignId) throw new NotFoundException()

    const reviewCampaign = await this.reviewCampaignRepository.findOne({
      where: {
        id: agentSession.campaignId,
        organizationId: agentSession.organizationId,
        projectId: agentSession.projectId,
      },
    })
    if (!reviewCampaign) throw new NotFoundException()

    const requestWithReviewCampaign =
      request as EndpointRequestWithAgentSessionReviewCampaign<ConversationAgentSession>
    requestWithReviewCampaign.reviewCampaign = reviewCampaign
  }
}

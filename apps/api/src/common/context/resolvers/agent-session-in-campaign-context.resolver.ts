import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { ReviewCampaignAgentType } from "@/domains/review-campaigns/review-campaigns.types"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithAgentSessionInCampaign,
  EndpointRequestWithProject,
} from "../request.interface"

@Injectable()
export class AgentSessionInCampaignContextResolver implements ContextResolver {
  readonly resource = "agentSessionInCampaign" as const

  constructor(
    @InjectRepository(ConversationAgentSession)
    private readonly conversationRepository: Repository<ConversationAgentSession>,
    @InjectRepository(FormAgentSession)
    private readonly formRepository: Repository<FormAgentSession>,
    @InjectRepository(ReviewCampaign)
    private readonly reviewCampaignRepository: Repository<ReviewCampaign>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const params = (request as ResolvableRequest & { params: { sessionId?: string } }).params
    const sessionId = params?.sessionId
    if (!sessionId || sessionId === ":sessionId") throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const scope = {
      id: sessionId,
      organizationId: requestWithProject.organizationId,
      projectId: requestWithProject.project.id,
    }

    const found = await this.findSession(scope)
    if (!found) throw new NotFoundException(`Agent session ${sessionId} not found`)
    const { session, agentType } = found

    if (!session.campaignId) {
      throw new UnprocessableEntityException(
        `Agent session ${sessionId} is not attached to a review campaign`,
      )
    }

    const campaign = await this.reviewCampaignRepository.findOne({
      where: {
        id: session.campaignId,
        organizationId: requestWithProject.organizationId,
        projectId: requestWithProject.project.id,
      },
    })
    if (!campaign) throw new NotFoundException(`Review campaign ${session.campaignId} not found`)

    const enriched = request as EndpointRequestWithAgentSessionInCampaign
    enriched.reviewCampaign = campaign
    enriched.agentSessionInCampaign = {
      sessionId: session.id,
      agentType,
      userId: session.userId,
    }
  }

  private async findSession(scope: {
    id: string
    organizationId: string
    projectId: string
  }): Promise<{
    session: ConversationAgentSession | FormAgentSession | ExtractionAgentSession
    agentType: ReviewCampaignAgentType
  } | null> {
    const conversation = await this.conversationRepository.findOne({ where: scope })
    if (conversation) return { session: conversation, agentType: "conversation" }

    const form = await this.formRepository.findOne({ where: scope })
    if (form) return { session: form, agentType: "form" }

    return null
  }
}

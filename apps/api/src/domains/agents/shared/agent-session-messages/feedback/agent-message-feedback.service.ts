import type { AgentMessageFeedbackRating } from "@caseai-connect/api-contracts"
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { AgentMessage } from "../agent-message.entity"
import { AgentMessageFeedback } from "./agent-message-feedback.entity"

@Injectable()
export class AgentMessageFeedbackService {
  constructor(
    @InjectRepository(AgentMessageFeedback)
    feedbackRepository: Repository<AgentMessageFeedback>,
    @InjectRepository(AgentMessage)
    agentMessageRepository: Repository<AgentMessage>,
    private readonly permissionService: PermissionService,
  ) {
    this.feedbackConnectRepository = new ConnectRepository(
      feedbackRepository,
      "agent_message_feedbacks",
    )
    this.agentMessageConnectRepository = new ConnectRepository(
      agentMessageRepository,
      "agent_messages",
    )
  }
  private readonly feedbackConnectRepository: ConnectRepository<AgentMessageFeedback>
  private readonly agentMessageConnectRepository: ConnectRepository<AgentMessage>

  /**
   * Saves the caller's feedback on a message of one of their own conversations. A message of
   * someone else's conversation answers 404, like a message that does not exist. In a review
   * campaign session, the campaign of that session must be the one that lets the tester give
   * feedback: another active campaign of the same project does not count.
   */
  async createFeedback({
    connectScope,
    userId,
    agentMessageId,
    rating,
    content,
  }: {
    connectScope: RequiredConnectScope
    userId: string
    agentMessageId: string
    rating: AgentMessageFeedbackRating
    content: string
  }): Promise<AgentMessageFeedback> {
    const [agentMessage] = await this.agentMessageConnectRepository.find(connectScope, {
      where: { id: agentMessageId, conversationAgentSession: { userId } },
      relations: ["conversationAgentSession"],
    })
    const session = agentMessage?.conversationAgentSession
    if (!session) throw new NotFoundException("Agent message not found")

    if (session.campaignId) {
      const isAllowedByTheSessionCampaign =
        await this.permissionService.hasProjectPermissionFromReviewCampaign(
          userId,
          PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION,
          session.campaignId,
        )
      if (!isAllowedByTheSessionCampaign) {
        throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      }
    }

    return await this.feedbackConnectRepository.createAndSave(connectScope, {
      userId,
      agentMessageId,
      rating,
      content,
    })
  }

  async listFeedbacksForAgent({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<{
    agentMessages: AgentMessage[]
    agentMessageFeedbacks: AgentMessageFeedback[]
  }> {
    const agentMessages = await this.agentMessageConnectRepository.find(connectScope, {
      where: { conversationAgentSession: { agentId } },
      relations: ["conversationAgentSession"],
    })
    const agentMessageIds = agentMessages.map((message) => message.id)
    const agentMessageFeedbacks = await this.feedbackConnectRepository.find(connectScope, {
      where: { agentMessageId: In(agentMessageIds) },
      order: { createdAt: "DESC" },
    })
    return {
      agentMessages,
      agentMessageFeedbacks,
    }
  }

  async findById({
    connectScope,
    feedbackId,
  }: {
    connectScope: RequiredConnectScope
    feedbackId: string
  }): Promise<AgentMessageFeedback | null> {
    return await this.feedbackConnectRepository.getOneById(connectScope, feedbackId)
  }
}

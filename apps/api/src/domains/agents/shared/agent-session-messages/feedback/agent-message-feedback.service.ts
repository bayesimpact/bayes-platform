import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { AgentMessage } from "../agent-message.entity"
import { AgentMessageFeedback } from "./agent-message-feedback.entity"

@Injectable()
export class AgentMessageFeedbackService {
  constructor(
    @InjectRepository(AgentMessageFeedback)
    feedbackRepository: Repository<AgentMessageFeedback>,
    @InjectRepository(AgentMessage)
    agentMessageRepository: Repository<AgentMessage>,
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
  async createFeedback({
    connectScope,
    userId,
    agentMessageId,
    content,
  }: {
    connectScope: RequiredConnectScope
    userId: string
    agentMessageId: string
    content: string
  }): Promise<AgentMessageFeedback | null> {
    const agentMessage = await this.agentMessageConnectRepository.getOneById(
      connectScope,
      agentMessageId,
    )
    if (!agentMessage) {
      return null
    }
    return await this.feedbackConnectRepository.createAndSave(connectScope, {
      userId,
      agentMessageId,
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

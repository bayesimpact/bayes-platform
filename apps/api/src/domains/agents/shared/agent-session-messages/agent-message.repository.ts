import { Injectable } from "@nestjs/common"
import { LessThanOrEqual, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentMessage } from "./agent-message.entity"

export type AgentMessageWithHistory = {
  /** The message, with its session and the agent settings of the revision that wrote it. */
  message: AgentMessage
  /** The messages of its session written before it, oldest first. */
  earlierMessages: AgentMessage[]
}

@Injectable()
export class AgentMessageRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * A message of the caller's project and what came before it in its session, whoever wrote the
   * session. Null when the project has no message with that id.
   */
  async findWithHistory(
    connectScope: RequiredConnectScope,
    agentMessageId: string,
  ): Promise<AgentMessageWithHistory | null> {
    const message = await this.connectRepo().getOneById(connectScope, agentMessageId, {
      relations: ["agentSettings", "conversationAgentSession"],
    })
    if (!message) return null

    const sessionMessages = await this.connectRepo().find(connectScope, {
      where: { sessionId: message.sessionId, createdAt: LessThanOrEqual(message.createdAt) },
      order: { createdAt: "ASC" },
    })
    return {
      message,
      earlierMessages: sessionMessages.filter((sessionMessage) => sessionMessage.id !== message.id),
    }
  }

  private connectRepo(): ConnectRepository<AgentMessage> {
    return new ConnectRepository(this.repo(), "agentMessage")
  }

  private repo(): Repository<AgentMessage> {
    return this.transactionService.getManager().getRepository(AgentMessage)
  }
}

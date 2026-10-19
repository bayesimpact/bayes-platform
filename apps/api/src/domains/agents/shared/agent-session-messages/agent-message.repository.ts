import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentMessage } from "./agent-message.entity"
import { AgentMessageFeedback } from "./feedback/agent-message-feedback.entity"

@Injectable()
export class AgentMessageRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** The session of the message an attachment is attached to, null while none holds it. */
  async findSessionIdOfAttachment(
    connectScope: RequiredConnectScope,
    attachmentDocumentId: string,
  ): Promise<string | null> {
    const [message] = await this.connectRepo().find(connectScope, {
      where: { attachmentDocumentId },
      select: { id: true, sessionId: true },
      take: 1,
    })
    return message?.sessionId ?? null
  }

  /** Removes the messages of these sessions with their feedback, soft-deleted rows included. */
  async deleteForSessions(connectScope: RequiredConnectScope, sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return
    const messages = await this.connectRepo().find(connectScope, {
      where: { sessionId: In(sessionIds) },
      select: { id: true },
      withDeleted: true,
    })
    const messageIds = messages.map((message) => message.id)
    if (messageIds.length > 0) {
      // The feedback references its message: it goes first.
      await this.transactionService
        .getManager()
        .getRepository(AgentMessageFeedback)
        .delete({ agentMessageId: In(messageIds) })
    }
    await this.connectRepo().deleteManyBy({
      connectScope,
      where: { sessionId: In(sessionIds) },
      softDelete: false,
    })
  }

  private connectRepo(): ConnectRepository<AgentMessage> {
    return new ConnectRepository(this.repo(), "agentMessage")
  }

  private repo(): Repository<AgentMessage> {
    return this.transactionService.getManager().getRepository(AgentMessage)
  }
}

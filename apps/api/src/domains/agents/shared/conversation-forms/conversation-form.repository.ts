import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { ConversationForm } from "./conversation-form.entity"

@Injectable()
export class ConversationFormRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** Removes the forms of these sessions, soft-deleted ones included. */
  async deleteForSessions(connectScope: RequiredConnectScope, sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return
    await this.connectRepo().deleteManyBy({
      connectScope,
      where: { sessionId: In(sessionIds) },
      softDelete: false,
    })
  }

  private connectRepo(): ConnectRepository<ConversationForm> {
    return new ConnectRepository(this.repo(), "conversationForm")
  }

  private repo(): Repository<ConversationForm> {
    return this.transactionService.getManager().getRepository(ConversationForm)
  }
}

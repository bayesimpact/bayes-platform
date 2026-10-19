import { Injectable } from "@nestjs/common"
import { In, IsNull, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { ConversationAgentSession } from "./conversation-agent-session.entity"

@Injectable()
export class ConversationAgentSessionRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * The relay sub-sessions a conversation spawned, whatever agent they belong to. Soft-deleted ones
   * count: deleting a sub-agent soft-deletes its sub-sessions, which still belong to the conversation.
   */
  async findSubSessionIds(
    connectScope: RequiredConnectScope,
    parentSessionId: string,
  ): Promise<string[]> {
    const subSessions = await this.connectRepo().find(connectScope, {
      where: { parentSessionId },
      select: { id: true },
      withDeleted: true,
    })
    return subSessions.map((subSession) => subSession.id)
  }

  async deleteSession(
    connectScope: RequiredConnectScope,
    { agentId, sessionId }: { agentId: string; sessionId: string },
  ): Promise<void> {
    await this.connectRepo().deleteManyBy({
      connectScope,
      where: { agentId, id: sessionId },
      softDelete: false,
    })
  }

  async deleteSubSessions(
    connectScope: RequiredConnectScope,
    subSessionIds: string[],
  ): Promise<void> {
    if (subSessionIds.length === 0) return
    await this.connectRepo().deleteManyBy({
      connectScope,
      where: { id: In(subSessionIds) },
      softDelete: false,
    })
  }

  /**
   * The conversations testers had in a review campaign, optionally one tester's. Only root
   * sessions count: the relay sub-sessions they spawned are part of those conversations.
   */
  findCampaignConversations(
    connectScope: RequiredConnectScope,
    { campaignId, userId }: { campaignId: string; userId?: string },
  ): Promise<ConversationAgentSession[]> {
    return this.connectRepo().find(connectScope, {
      where: { campaignId, parentSessionId: IsNull(), ...(userId ? { userId } : {}) },
    })
  }

  countCampaignConversations(
    connectScope: RequiredConnectScope,
    campaignId: string,
  ): Promise<number> {
    return this.repo().count({
      where: {
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        campaignId,
        parentSessionId: IsNull(),
      },
    })
  }

  private connectRepo(): ConnectRepository<ConversationAgentSession> {
    return new ConnectRepository(this.repo(), "conversationAgentSession")
  }

  private repo(): Repository<ConversationAgentSession> {
    return this.transactionService.getManager().getRepository(ConversationAgentSession)
  }
}

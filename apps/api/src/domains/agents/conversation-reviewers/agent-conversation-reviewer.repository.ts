import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentConversationReviewer } from "./agent-conversation-reviewer.entity"

export type AgentConversationReviewerRecord = {
  userId: string
  email: string
  name: string | null
  grantedAt: Date
}

@Injectable()
export class AgentConversationReviewerRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async isReviewer({ userId, agentId }: { userId: string; agentId: string }): Promise<boolean> {
    return this.repo().exists({ where: { userId, agentId } })
  }

  async listAgentIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.repo().find({ where: { userId }, select: { agentId: true } })
    return rows.map((row) => row.agentId)
  }

  /** The reviewers of one agent, by email. */
  async listReviewersOfAgent(agentId: string): Promise<AgentConversationReviewerRecord[]> {
    const rows = await this.repo().find({
      where: { agentId },
      relations: { user: true },
      order: { createdAt: "ASC" },
    })
    return rows
      .map((row) => ({
        userId: row.userId,
        email: row.user.email,
        name: row.user.name,
        grantedAt: row.createdAt,
      }))
      .sort((left, right) =>
        left.email.localeCompare(right.email, undefined, { sensitivity: "base" }),
      )
  }

  /** Returns true when the right was granted, false when the user already had it. */
  async grant({
    userId,
    agentId,
    grantedByUserId,
  }: {
    userId: string
    agentId: string
    grantedByUserId: string
  }): Promise<boolean> {
    const result = await this.repo()
      .createQueryBuilder()
      .insert()
      .values({ userId, agentId, grantedByUserId })
      .orIgnore()
      .returning(["id"])
      .execute()
    // ON CONFLICT DO NOTHING returns no row when the pair already exists.
    return Array.isArray(result.raw) && result.raw.length > 0
  }

  /** Returns true when the right was revoked, false when the user did not have it. */
  async revoke({ userId, agentId }: { userId: string; agentId: string }): Promise<boolean> {
    const result = await this.repo().delete({ userId, agentId })
    return (result.affected ?? 0) > 0
  }

  private repo(): Repository<AgentConversationReviewer> {
    return this.transactionService.getManager().getRepository(AgentConversationReviewer)
  }
}

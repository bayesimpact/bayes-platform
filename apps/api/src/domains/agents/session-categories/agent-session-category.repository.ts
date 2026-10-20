import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentSessionCategory } from "./agent-session-category.entity"

@Injectable()
export class AgentSessionCategoryRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Gives `toAgentId` the active conversation categories of `fromAgentId` that the project still
   * has, as an agent created now could get them.
   */
  async copyActiveCategories({
    fromAgentId,
    toAgentId,
  }: {
    fromAgentId: string
    toAgentId: string
  }): Promise<number> {
    const categories = await this.repo().find({
      where: { agentId: fromAgentId },
      relations: { projectAgentSessionCategory: true },
      order: { name: "ASC" },
    })
    const copies = categories
      .filter(
        (category) =>
          category.projectAgentSessionCategory &&
          category.projectAgentSessionCategory.deletedAt === null,
      )
      .map((category) =>
        this.repo().create({
          agentId: toAgentId,
          projectAgentSessionCategoryId: category.projectAgentSessionCategoryId,
          name: category.name,
        }),
      )
    if (copies.length > 0) await this.repo().save(copies)
    return copies.length
  }

  private repo(): Repository<AgentSessionCategory> {
    return this.transactionService.getManager().getRepository(AgentSessionCategory)
  }
}

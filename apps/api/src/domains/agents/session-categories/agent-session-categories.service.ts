import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AgentSessionCategory } from "./agent-session-category.entity"
import type { ProjectAgentSessionCategory } from "./project-agent-session-category.entity"

export type ReplaceAgentSessionCategoriesResult = {
  createdCount: number
  restoredCount: number
  deletedCount: number
}

type SelectedProjectAgentSessionCategory = Pick<ProjectAgentSessionCategory, "id" | "name">

@Injectable()
export class AgentSessionCategoriesService {
  constructor(
    @InjectRepository(AgentSessionCategory)
    private readonly agentSessionCategoryRepository: Repository<AgentSessionCategory>,
  ) {}

  async addCategoryToAgent(
    agentId: string,
    projectAgentSessionCategory: SelectedProjectAgentSessionCategory,
  ): Promise<void> {
    const existing = await this.agentSessionCategoryRepository.findOne({
      where: { agentId, projectAgentSessionCategoryId: projectAgentSessionCategory.id },
      withDeleted: true,
    })

    if (existing) {
      if (existing.deletedAt !== null) {
        await this.agentSessionCategoryRepository.recover(existing)
      }
      return
    }

    const agentSessionCategory = this.agentSessionCategoryRepository.create({
      agentId,
      projectAgentSessionCategoryId: projectAgentSessionCategory.id,
      name: projectAgentSessionCategory.name,
    })
    await this.agentSessionCategoryRepository.save(agentSessionCategory)
  }

  async listActiveCategoryNamesForAgent(agentId: string): Promise<string[]> {
    const activeCategories = await this.agentSessionCategoryRepository.find({
      where: { agentId },
      order: { name: "ASC" },
    })
    return activeCategories.map((agentSessionCategory) => agentSessionCategory.name)
  }

  async listActiveCategoriesForAgent(agentId: string): Promise<AgentSessionCategory[]> {
    return this.agentSessionCategoryRepository.find({
      where: { agentId },
      relations: { conversationSessionCategories: true },
      order: { name: "ASC" },
    })
  }

  /**
   * Sets the active category set for an agent: creates missing rows, restores soft-deleted
   * matches, and soft-deletes active rows not in `categoryNames`.
   */
  async replaceActiveCategoriesForAgent(
    agentId: string,
    selectedProjectCategories: SelectedProjectAgentSessionCategory[],
  ): Promise<ReplaceAgentSessionCategoriesResult> {
    const existingAgentSessionCategories = await this.agentSessionCategoryRepository.find({
      where: { agentId },
      withDeleted: true,
      relations: { conversationSessionCategories: true },
      order: { name: "ASC" },
    })

    const desiredProjectCategoryIds = new Set(
      selectedProjectCategories.map((projectCategory) => projectCategory.id),
    )
    const existingCategoryByProjectCategoryId = new Map(
      existingAgentSessionCategories.map((existingAgentSessionCategory) => [
        existingAgentSessionCategory.projectAgentSessionCategoryId,
        existingAgentSessionCategory,
      ]),
    )

    let createdCount = 0
    let restoredCount = 0
    let deletedCount = 0

    for (const selectedProjectCategory of selectedProjectCategories) {
      const existingAgentSessionCategory = existingCategoryByProjectCategoryId.get(
        selectedProjectCategory.id,
      )
      if (!existingAgentSessionCategory) {
        const createdAgentSessionCategory = this.agentSessionCategoryRepository.create({
          agentId,
          projectAgentSessionCategoryId: selectedProjectCategory.id,
          name: selectedProjectCategory.name,
        })
        await this.agentSessionCategoryRepository.save(createdAgentSessionCategory)
        createdCount += 1
        continue
      }

      if (existingAgentSessionCategory.deletedAt !== null) {
        await this.agentSessionCategoryRepository.recover(existingAgentSessionCategory)
        restoredCount += 1
      }
    }

    for (const existingAgentSessionCategory of existingAgentSessionCategories) {
      const shouldStayActive =
        existingAgentSessionCategory.projectAgentSessionCategoryId !== null &&
        desiredProjectCategoryIds.has(existingAgentSessionCategory.projectAgentSessionCategoryId)
      const isCurrentlyActive = existingAgentSessionCategory.deletedAt === null
      const isUsedInConversation =
        (existingAgentSessionCategory.conversationSessionCategories?.length ?? 0) > 0
      if (!shouldStayActive && isCurrentlyActive && isUsedInConversation) {
        throw new BadRequestException(
          `Category "${existingAgentSessionCategory.name}" cannot be removed because it is already assigned to a conversation.`,
        )
      }
      if (!shouldStayActive && isCurrentlyActive) {
        await this.agentSessionCategoryRepository.softDelete(existingAgentSessionCategory.id)
        deletedCount += 1
      }
    }

    return {
      createdCount,
      restoredCount,
      deletedCount,
    }
  }
}

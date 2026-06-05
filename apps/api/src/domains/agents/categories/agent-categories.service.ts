import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AgentCategory } from "./agent-category.entity"
import type { ProjectAgentCategory } from "./project-agent-category.entity"

export type ReplaceAgentCategoriesResult = {
  createdCount: number
  restoredCount: number
  deletedCount: number
}

type SelectedProjectAgentCategory = Pick<ProjectAgentCategory, "id" | "name">

@Injectable()
export class AgentCategoriesService {
  constructor(
    @InjectRepository(AgentCategory)
    private readonly agentCategoryRepository: Repository<AgentCategory>,
  ) {}

  async addCategoryToAgent(
    agentId: string,
    projectAgentCategory: SelectedProjectAgentCategory,
  ): Promise<void> {
    const existing = await this.agentCategoryRepository.findOne({
      where: { agentId, projectAgentCategoryId: projectAgentCategory.id },
      withDeleted: true,
    })

    if (existing) {
      if (existing.deletedAt !== null) {
        await this.agentCategoryRepository.recover(existing)
      }
      return
    }

    const agentCategory = this.agentCategoryRepository.create({
      agentId,
      projectAgentCategoryId: projectAgentCategory.id,
      name: projectAgentCategory.name,
    })
    await this.agentCategoryRepository.save(agentCategory)
  }

  async listActiveCategoryNamesForAgent(agentId: string): Promise<string[]> {
    const activeCategories = await this.agentCategoryRepository.find({
      where: { agentId },
      order: { name: "ASC" },
    })
    return activeCategories.map((agentCategory) => agentCategory.name)
  }

  async listActiveCategoriesForAgent(agentId: string): Promise<AgentCategory[]> {
    return this.agentCategoryRepository.find({
      where: { agentId },
      relations: { sessionCategories: true },
      order: { name: "ASC" },
    })
  }

  /**
   * Sets the active category set for an agent: creates missing rows, restores soft-deleted
   * matches, and soft-deletes active rows not in `categoryNames`.
   */
  async replaceActiveCategoriesForAgent(
    agentId: string,
    selectedProjectCategories: SelectedProjectAgentCategory[],
  ): Promise<ReplaceAgentCategoriesResult> {
    const existingAgentCategories = await this.agentCategoryRepository.find({
      where: { agentId },
      withDeleted: true,
      relations: { sessionCategories: true },
      order: { name: "ASC" },
    })

    const desiredProjectCategoryIds = new Set(
      selectedProjectCategories.map((projectCategory) => projectCategory.id),
    )
    const existingCategoryByProjectCategoryId = new Map(
      existingAgentCategories.map((existingAgentCategory) => [
        existingAgentCategory.projectAgentCategoryId,
        existingAgentCategory,
      ]),
    )

    let createdCount = 0
    let restoredCount = 0
    let deletedCount = 0

    for (const selectedProjectCategory of selectedProjectCategories) {
      const existingAgentCategory = existingCategoryByProjectCategoryId.get(
        selectedProjectCategory.id,
      )
      if (!existingAgentCategory) {
        const createdAgentCategory = this.agentCategoryRepository.create({
          agentId,
          projectAgentCategoryId: selectedProjectCategory.id,
          name: selectedProjectCategory.name,
        })
        await this.agentCategoryRepository.save(createdAgentCategory)
        createdCount += 1
        continue
      }

      if (existingAgentCategory.deletedAt !== null) {
        await this.agentCategoryRepository.recover(existingAgentCategory)
        restoredCount += 1
      }
    }

    for (const existingAgentCategory of existingAgentCategories) {
      const shouldStayActive =
        existingAgentCategory.projectAgentCategoryId !== null &&
        desiredProjectCategoryIds.has(existingAgentCategory.projectAgentCategoryId)
      const isCurrentlyActive = existingAgentCategory.deletedAt === null
      const isUsedInConversation = (existingAgentCategory.sessionCategories?.length ?? 0) > 0
      if (!shouldStayActive && isCurrentlyActive && isUsedInConversation) {
        throw new BadRequestException(
          `Category "${existingAgentCategory.name}" cannot be removed because it is already assigned to a conversation.`,
        )
      }
      if (!shouldStayActive && isCurrentlyActive) {
        await this.agentCategoryRepository.softDelete(existingAgentCategory.id)
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

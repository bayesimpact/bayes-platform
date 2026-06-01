import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ProjectAgentCategory } from "./project-agent-category.entity"

@Injectable()
export class ProjectAgentCategoriesService {
  constructor(
    @InjectRepository(ProjectAgentCategory)
    private readonly projectAgentCategoryRepository: Repository<ProjectAgentCategory>,
  ) {}

  async addProjectAgentCategory(
    projectId: string,
    name: string,
  ): Promise<ProjectAgentCategory> {
    const normalizedName = name.trim()

    const existing = await this.projectAgentCategoryRepository.findOne({
      where: { projectId, name: normalizedName },
      withDeleted: true,
    })

    if (existing) {
      if (existing.deletedAt !== null) {
        await this.projectAgentCategoryRepository.recover(existing)
      }
      return existing
    }

    const created = this.projectAgentCategoryRepository.create({ projectId, name: normalizedName })
    return this.projectAgentCategoryRepository.save(created)
  }

  async deleteProjectAgentCategory(projectId: string, categoryId: string): Promise<void> {
    const category = await this.projectAgentCategoryRepository.findOne({
      where: { id: categoryId, projectId },
      relations: { sessionCategories: true, agentCategories: { sessionCategories: true } },
    })

    if (!category) return

    const isUsedInConversation =
      category.sessionCategories.length > 0 ||
      category.agentCategories.some(
        (agentCategory) => agentCategory.sessionCategories.length > 0,
      )

    if (isUsedInConversation) {
      throw new BadRequestException(
        `Category "${category.name}" cannot be removed because it is already assigned to a conversation.`,
      )
    }

    await this.projectAgentCategoryRepository.softDelete(categoryId)
  }
}

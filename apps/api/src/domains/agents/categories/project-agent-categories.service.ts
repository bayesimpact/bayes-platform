import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCategoriesService } from "./agent-categories.service"
import { ProjectAgentCategory } from "./project-agent-category.entity"

@Injectable()
export class ProjectAgentCategoriesService {
  constructor(
    @InjectRepository(ProjectAgentCategory)
    private readonly projectAgentCategoryRepository: Repository<ProjectAgentCategory>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentCategoriesService: AgentCategoriesService,
  ) {}

  async addProjectAgentCategory(
    projectId: string,
    name: string,
    assignToAllConversationalAgents: boolean,
  ): Promise<ProjectAgentCategory> {
    const normalizedName = name.trim()

    const existing = await this.projectAgentCategoryRepository.findOne({
      where: { projectId, name: normalizedName },
      withDeleted: true,
    })

    let category: ProjectAgentCategory
    if (existing) {
      if (existing.deletedAt !== null) {
        await this.projectAgentCategoryRepository.recover(existing)
      }
      category = existing
    } else {
      const created = this.projectAgentCategoryRepository.create({
        projectId,
        name: normalizedName,
      })
      category = await this.projectAgentCategoryRepository.save(created)
    }

    if (assignToAllConversationalAgents) {
      const conversationalAgents = await this.agentRepository.find({
        where: { projectId, type: "conversation" },
        select: { id: true },
      })
      for (const agent of conversationalAgents) {
        await this.agentCategoriesService.addCategoryToAgent(agent.id, category)
      }
    }

    return category
  }

  async deleteProjectAgentCategory(projectId: string, categoryId: string): Promise<void> {
    const category = await this.projectAgentCategoryRepository.findOne({
      where: { id: categoryId, projectId },
      relations: { sessionCategories: true, agentCategories: { sessionCategories: true } },
    })

    if (!category) return

    const isUsedInConversation =
      category.sessionCategories.length > 0 ||
      category.agentCategories.some((agentCategory) => agentCategory.sessionCategories.length > 0)

    if (isUsedInConversation) {
      throw new BadRequestException(
        `Category "${category.name}" cannot be removed because it is already assigned to a conversation.`,
      )
    }

    await this.projectAgentCategoryRepository.softDelete(categoryId)
  }
}

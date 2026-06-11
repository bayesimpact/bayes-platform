import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "./agent-session-categories.service"
import { ProjectSessionCategory } from "./project-session-category.entity"

@Injectable()
export class ProjectSessionCategoriesService {
  constructor(
    @InjectRepository(ProjectSessionCategory)
    private readonly projectSessionCategoryRepository: Repository<ProjectSessionCategory>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentSessionCategoriesService: AgentSessionCategoriesService,
  ) {}

  async addProjectSessionCategory(
    projectId: string,
    name: string,
    assignToAllConversationalAgents: boolean,
  ): Promise<ProjectSessionCategory> {
    const normalizedName = name.trim()

    const existing = await this.projectSessionCategoryRepository.findOne({
      where: { projectId, name: normalizedName },
      withDeleted: true,
    })

    let category: ProjectSessionCategory
    if (existing) {
      if (existing.deletedAt !== null) {
        await this.projectSessionCategoryRepository.recover(existing)
      }
      category = existing
    } else {
      const created = this.projectSessionCategoryRepository.create({
        projectId,
        name: normalizedName,
      })
      category = await this.projectSessionCategoryRepository.save(created)
    }

    if (assignToAllConversationalAgents) {
      const conversationalAgents = await this.agentRepository.find({
        where: { projectId, type: "conversation" },
        select: { id: true },
      })
      for (const agent of conversationalAgents) {
        await this.agentSessionCategoriesService.addCategoryToAgent(agent.id, category)
      }
    }

    return category
  }

  async deleteProjectSessionCategory(projectId: string, categoryId: string): Promise<void> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(categoryId)) return

    const category = await this.projectSessionCategoryRepository.findOne({
      where: { id: categoryId, projectId },
      relations: {
        conversationSessionCategories: true,
        agentSessionCategories: { conversationSessionCategories: true },
      },
    })

    if (!category) return

    const isUsedInConversation =
      category.conversationSessionCategories.length > 0 ||
      category.agentSessionCategories.some(
        (agentSessionCategory) => agentSessionCategory.conversationSessionCategories.length > 0,
      )

    if (isUsedInConversation) {
      throw new BadRequestException(
        `Category "${category.name}" cannot be removed because it is already assigned to a conversation.`,
      )
    }

    await this.projectSessionCategoryRepository.softDelete(categoryId)
  }
}

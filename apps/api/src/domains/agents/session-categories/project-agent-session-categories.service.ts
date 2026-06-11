import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "./agent-session-categories.service"
import { ProjectAgentSessionCategory } from "./project-agent-session-category.entity"

@Injectable()
export class ProjectAgentSessionCategoriesService {
  constructor(
    @InjectRepository(ProjectAgentSessionCategory)
    private readonly projectAgentSessionCategoryRepository: Repository<ProjectAgentSessionCategory>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentSessionCategoriesService: AgentSessionCategoriesService,
  ) {}

  async addProjectAgentSessionCategory(
    projectId: string,
    name: string,
    assignToAllConversationalAgents: boolean,
  ): Promise<ProjectAgentSessionCategory> {
    const normalizedName = name.trim()

    const existing = await this.projectAgentSessionCategoryRepository.findOne({
      where: { projectId, name: normalizedName },
      withDeleted: true,
    })

    let category: ProjectAgentSessionCategory
    if (existing) {
      if (existing.deletedAt !== null) {
        await this.projectAgentSessionCategoryRepository.recover(existing)
      }
      category = existing
    } else {
      const created = this.projectAgentSessionCategoryRepository.create({
        projectId,
        name: normalizedName,
      })
      category = await this.projectAgentSessionCategoryRepository.save(created)
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

  async deleteProjectAgentSessionCategory(projectId: string, categoryId: string): Promise<void> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(categoryId)) return

    const category = await this.projectAgentSessionCategoryRepository.findOne({
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

    await this.projectAgentSessionCategoryRepository.softDelete(categoryId)
  }
}

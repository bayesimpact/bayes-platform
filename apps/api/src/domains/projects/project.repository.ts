import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMFeatures } from "@/common/interfaces/llm-provider.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Project } from "./project.entity"
import { ProjectModel } from "./project.model"

/** Persisted project row, for when permissions are not resolvable yet. */
export type ProjectRecord = {
  id: string
  organizationId: string
  name: string
  createdAt: Date
  updatedAt: Date
  conversationRetentionDays: number
}

@Injectable()
export class ProjectRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** Hydrates the projects of the map keys as models carrying their permissions. */
  async findAllByIds(permissionsByProjectId: Map<string, string[]>): Promise<ProjectModel[]> {
    const projectIds = [...permissionsByProjectId.keys()]
    if (projectIds.length === 0) {
      return []
    }

    const projects = await this.repo().find({
      where: { id: In(projectIds) },
      relations: { featureFlags: true, projectAgentSessionCategories: true },
      order: { createdAt: "DESC" },
    })

    return projects.map((project) =>
      ProjectModel.fromEntity(project, permissionsByProjectId.get(project.id) ?? []),
    )
  }

  /** Same as findAllByIds, restricted to the projects of one organization. */
  async findAllByOrganizationIdAndIds(
    organizationId: string,
    permissionsByProjectId: Map<string, string[]>,
  ): Promise<ProjectModel[]> {
    const projectIds = [...permissionsByProjectId.keys()]
    if (projectIds.length === 0) {
      return []
    }

    const projects = await this.repo().find({
      where: { organizationId, id: In(projectIds) },
      relations: { featureFlags: true, projectAgentSessionCategories: true },
      order: { createdAt: "DESC" },
    })

    return projects.map((project) =>
      ProjectModel.fromEntity(project, permissionsByProjectId.get(project.id) ?? []),
    )
  }

  async createProject(params: { organizationId: string; name: string }): Promise<ProjectRecord> {
    const saved = await this.repo().save(this.repo().create(params))
    return this.toRecord(saved)
  }

  /** Returns null when the project does not exist. An absent retention field leaves the column untouched. */
  async updateProject(
    projectId: string,
    updates: { name: string; conversationRetentionDays?: number },
  ): Promise<ProjectRecord | null> {
    const project = await this.repo().findOne({ where: { id: projectId } })
    if (!project) {
      return null
    }

    project.name = updates.name
    if (updates.conversationRetentionDays !== undefined) {
      project.conversationRetentionDays = updates.conversationRetentionDays
    }
    const saved = await this.repo().save(project)
    return this.toRecord(saved)
  }

  async getLlmFeatures(connectScope: RequiredConnectScope): Promise<LLMFeatures> {
    const priorityCalls = await this.isFeatureEnabled({
      projectId: connectScope.projectId,
      feature: "llm-priority-calls",
    })
    const flexWorkers = await this.isFeatureEnabled({
      projectId: connectScope.projectId,
      feature: "llm-flex-workers",
    })
    return {
      priorityCalls,
      flexWorkers: flexWorkers && process.env.LLM_VERTEX3_ENABLE_FLEX_FOR_WORKERS === "true", //kill switch by env variable
    }
  }
  /** Queried through the featureFlags relation to keep this repository on the Project entity only. */
  async isFeatureEnabled({
    projectId,
    feature,
  }: {
    projectId: string
    feature: string
  }): Promise<boolean> {
    return this.repo().exists({
      where: { id: projectId, featureFlags: { featureFlagKey: feature, enabled: true } },
    })
  }

  async softDelete(projectId: string): Promise<void> {
    const entityManager = this.transactionService.getManager()

    for (const entity of ALL_ENTITIES) {
      const hasProjectId = entityManager.connection
        .getMetadata(entity)
        .columns.some((column) => column.propertyName === "projectId")
      if (hasProjectId) {
        await entityManager.softDelete(entity, { projectId })
      }
    }

    await entityManager.softDelete(Project, { id: projectId })
  }

  private toRecord(project: Project): ProjectRecord {
    return {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      conversationRetentionDays: project.conversationRetentionDays,
    }
  }

  private repo(): Repository<Project> {
    return this.transactionService.getManager().getRepository(Project)
  }
}

import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./memberships/project-memberships.service"
import { Project } from "./project.entity"

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(FeatureFlag) private readonly featureFlagRepository: Repository<FeatureFlag>,
    private readonly projectMembershipsService: ProjectMembershipsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async createProject(params: {
    organizationId: string
    userId: string
    name: string
  }): Promise<Project> {
    const project = this.projectRepository.create(params)
    await this.projectRepository.save(project)
    await this.projectMembershipsService.createProjectOwnerMembership({
      projectId: project.id,
      userId: params.userId,
    })
    return project
  }

  async listProjects({
    organizationId,
    userId,
  }: {
    organizationId: string
    userId: string
  }): Promise<Project[]> {
    return this.projectRepository.find({
      where: { organizationId, projectMemberships: { userId } },
      relations: { featureFlags: true, projectAgentSessionCategories: true },
      order: { createdAt: "DESC" },
    })
  }

  async getProject(organizationId: string, projectId: string): Promise<Project | undefined> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organizationId },
      relations: { featureFlags: true, projectAgentSessionCategories: true },
    })
    return project ?? undefined
  }

  async updateProject(project: Project, name: string): Promise<Project> {
    // Update the project
    project.name = name
    return this.projectRepository.save(project)
  }

  async deleteProject(project: Project): Promise<void> {
    await this.dataSource.transaction(async (entityManager) => {
      const projectId = project.id
      // Sweep everything directly scoped by projectId
      for (const entity of ALL_ENTITIES) {
        const hasProjectId = entityManager.connection
          .getMetadata(entity)
          .columns.some((column) => column.propertyName === "projectId")
        if (hasProjectId) {
          await entityManager.softDelete(entity, { projectId })
        }
      }

      await entityManager.softDelete(Project, { id: projectId })
    })
  }

  async hasFeature({
    connectScope,
    feature,
  }: {
    connectScope: RequiredConnectScope
    feature: FeatureFlagKey
  }): Promise<boolean> {
    const flag = await this.featureFlagRepository.findOne({
      where: {
        projectId: connectScope.projectId,
        featureFlagKey: feature,
        enabled: true,
      },
    })
    return flag !== null
  }
}

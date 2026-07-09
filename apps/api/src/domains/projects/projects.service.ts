import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "../documents/tags/document-tags.service"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./memberships/project-memberships.service"
import { Project } from "./project.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "./project.repository"

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(FeatureFlag) private readonly featureFlagRepository: Repository<FeatureFlag>,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly documentTagsService: DocumentTagsService,
    private readonly transactionService: TransactionService,
    private readonly projectsRepository: ProjectRepository,
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
    await this.documentTagsService.createPublicDocumentsTag({
      organizationId: params.organizationId,
      projectId: project.id,
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
    const memberships = await this.projectMembershipsService.listMembershipsForUser(userId)
    const projectIds = memberships.map((membership) => membership.projectId)
    if (projectIds.length === 0) {
      return []
    }

    return this.projectRepository.find({
      where: { organizationId, id: In(projectIds) },
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
    await this.transactionService.run(async () => {
      await this.projectsRepository.softDelete(project.id)
      await this.projectMembershipsService.softDeleteMembership({ projectId: project.id })
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

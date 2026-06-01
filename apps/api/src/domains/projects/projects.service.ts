import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: DataSource required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "../agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "../agents/agents.service"
import { Document } from "../documents/document.entity"
import { Evaluation } from "../evaluations/evaluation.entity"
import { EvaluationReport } from "../evaluations/reports/evaluation-report.entity"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import { ProjectMembership } from "./memberships/project-membership.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./memberships/project-memberships.service"
import { Project } from "./project.entity"

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(FeatureFlag) private readonly featureFlagRepository: Repository<FeatureFlag>,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentsService: AgentsService,
    private readonly dataSource: DataSource,
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
      relations: { featureFlags: true, projectAgentCategories: true },
      order: { createdAt: "DESC" },
    })
  }

  async getProject(organizationId: string, projectId: string): Promise<Project | undefined> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organizationId },
      relations: { featureFlags: true, projectAgentCategories: true },
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

      const agents = await entityManager.find(Agent, { where: { projectId }, select: { id: true } })
      for (const agent of agents) {
        await this.agentsService.deleteAgent(agent)
      }

      // Evaluations
      await entityManager.delete(EvaluationReport, { projectId })
      await entityManager.delete(Evaluation, { projectId })

      // Documents
      await entityManager.delete(Document, { projectId })

      // Project memberships
      await entityManager.delete(ProjectMembership, { projectId })

      await entityManager.delete(Project, { id: projectId })
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

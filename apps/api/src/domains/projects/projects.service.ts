import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMFeatures } from "@/common/interfaces/llm-provider.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { listRoleIds, unionRolePermissions } from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "../documents/tags/document-tags.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "./memberships/project-memberships.service"
import { ProjectModel } from "./project.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "./project.repository"

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly documentTagsService: DocumentTagsService,
    private readonly transactionService: TransactionService,
    private readonly permissionService: PermissionService,
  ) {}

  async createProject(params: {
    organizationId: string
    userId: string
    name: string
  }): Promise<ProjectModel> {
    const project = await this.projectRepository.createProject({
      organizationId: params.organizationId,
      name: params.name,
    })
    const membership = await this.projectMembershipsService.createProjectOwnerMembership({
      projectId: project.id,
      userId: params.userId,
    })
    await this.documentTagsService.createPublicDocumentsTag({
      organizationId: params.organizationId,
      projectId: project.id,
    })

    // the membership carries the RBAC roles it holds: ask RBAC what they grant
    const rolesById = await this.permissionService.listRolesById(listRoleIds([membership]))
    const permissions = unionRolePermissions(membership.roles, rolesById)
    return new ProjectModel(
      { ...project, featureFlags: [], agentSessionCategories: [] },
      permissions,
    )
  }

  async listUserProjects(userId: string): Promise<ProjectModel[]> {
    // all the project ids the user has access to, along with their permissions
    const permissionsByProjectId = await this.permissionService.listResourcePermissions(
      userId,
      "project.read",
    )

    return this.projectRepository.findAllByIds(permissionsByProjectId)
  }

  /**
   * Org-scoped listing: RBAC decides WHICH projects the user sees, but the
   * response (ProjectDto) carries no permissions, so entities are returned.
   */
  async listProjects({
    organizationId,
    userId,
  }: {
    organizationId: string
    userId: string
  }): Promise<ProjectModel[]> {
    const permissionsByProjectId = await this.permissionService.listResourcePermissions(
      userId,
      "project.read",
    )

    return this.projectRepository.findAllByOrganizationIdAndIds(
      organizationId,
      permissionsByProjectId,
    )
  }

  async updateProject({
    projectId,
    name,
    conversationRetentionDays,
    userId,
  }: {
    projectId: string
    name: string
    conversationRetentionDays?: number
    userId: string
  }): Promise<ProjectModel> {
    const updates: { name: string; conversationRetentionDays?: number } = { name }
    // undefined = do not change
    if (conversationRetentionDays !== undefined) {
      updates.conversationRetentionDays = conversationRetentionDays
    }
    const updated = await this.projectRepository.updateProject(projectId, updates)
    if (!updated) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }

    const permissionsByProjectId = await this.permissionService.listResourcePermissions(
      userId,
      "project.read",
    )
    return new ProjectModel(
      { ...updated, featureFlags: [], agentSessionCategories: [] },
      permissionsByProjectId.get(updated.id) ?? [],
    )
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.transactionService.run(async () => {
      await this.projectRepository.softDelete(projectId)
      await this.projectMembershipsService.deleteMembership({ projectId })
    })
  }
  async getLlmFeatures(connectScope: RequiredConnectScope): Promise<LLMFeatures> {
    return this.projectRepository.getLlmFeatures(connectScope)
  }

  async hasFeature({
    connectScope,
    feature,
  }: {
    connectScope: RequiredConnectScope
    feature: FeatureFlagKey
  }): Promise<boolean> {
    return this.projectRepository.isFeatureEnabled({
      projectId: connectScope.projectId,
      feature,
    })
  }
}

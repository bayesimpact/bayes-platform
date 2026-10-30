import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { groupMembershipRows } from "@/domains/memberships/membership-roles"
import { RoleGrant } from "@/domains/memberships/role-grant.entity"
import type { ProjectMembershipContextModel } from "@/domains/projects/memberships/project-membership.model"
import { Project } from "@/domains/projects/project.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithProject } from "../request.interface"

@Injectable()
export class ProjectContextResolver implements ContextResolver {
  readonly resource = "project" as const

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { projectId?: string }
    }
    const projectId = requestWithParams.params?.projectId

    if (!projectId || projectId === ":projectId") throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const project =
      (await this.projectRepository.findOne({
        where: {
          id: projectId,
          organizationId: requestWithProject.organizationId,
        },
      })) ?? undefined
    if (!project) throw new NotFoundException()

    const roleGrantRows = await this.dataSource.getRepository(RoleGrant).find({
      where: {
        userId: request.user.id,
        resourceId: project.id,
        resourceType: "project",
      },
      relations: { rbacRole: true },
    })
    // One row per role the caller holds on the project (ADR 0032), and none for an organization
    // admin or owner who reaches it through the organization. The request carries the roles,
    // read from the rows' `role_id`.
    const [group] = groupMembershipRows(roleGrantRows)
    const projectMembership: ProjectMembershipContextModel | undefined = group
      ? { userId: request.user.id, projectId: project.id, roles: group.roles }
      : undefined

    requestWithProject.project = project
    requestWithProject.projectMembership = projectMembership
  }
}

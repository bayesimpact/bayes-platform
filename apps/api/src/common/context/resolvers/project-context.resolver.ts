import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { groupMembershipRows } from "@/domains/memberships/membership-roles"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { ProjectMembershipModel } from "@/domains/projects/memberships/project-membership.model"
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

    const userMembershipRows = await this.dataSource.getRepository(UserMembership).find({
      where: {
        userId: request.user.id,
        resourceId: project.id,
        resourceType: "project",
      },
      relations: { rbacRole: true },
    })
    const [group] = groupMembershipRows(userMembershipRows)

    // The `as ProjectMembershipModel` below is intentional: we build the model from
    // user_membership rows without loading the `project` and `user` relations, which callers
    // of `request.projectMembership` never read (they read `userId` and `roles`).
    const projectMembership: ProjectMembershipModel | undefined = group
      ? ({
          id: group.oldest.id,
          userId: group.oldest.userId,
          projectId: project.id,
          roles: group.roles,
          createdAt: group.oldest.createdAt,
          updatedAt: group.updatedAt,
          deletedAt: group.oldest.deletedAt,
        } as ProjectMembershipModel)
      : undefined

    requestWithProject.project = project
    requestWithProject.projectMembership = projectMembership
  }
}

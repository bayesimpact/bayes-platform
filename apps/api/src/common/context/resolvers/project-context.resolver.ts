import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
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

    const userMembership =
      (await this.dataSource.getRepository(UserMembership).findOne({
        where: {
          userId: request.user.id,
          resourceId: project.id,
          resourceType: "project",
        },
      })) ?? undefined

    // TODO (cleanup PR): once ProjectMembership is removed, narrow the
    // request-interface type for projectMembership to a Pick of only what
    // policies actually read (projectId, role today), drop the `as` cast
    // below, and load the `project` / `user` relations only if a policy
    // starts needing them.
    //
    // The `as ProjectMembership` below is intentional: we build a plain DTO
    // from user_membership rows rather than a real entity instance, so the
    // `project` and `user` relation fields are absent. TypeScript would reject
    // `satisfies ProjectMembership` because of those missing fields. At runtime
    // this is safe — ProjectScopedPolicy only reads `projectMembership.projectId`
    // and `projectMembership.role`; the relation fields are never accessed.
    const projectMembership: ProjectMembership | undefined = userMembership
      ? ({
          id: userMembership.id,
          userId: userMembership.userId,
          projectId: project.id,
          role: userMembership.role,
          createdAt: userMembership.createdAt,
          updatedAt: userMembership.updatedAt,
          deletedAt: userMembership.deletedAt,
        } as ProjectMembership)
      : undefined

    requestWithProject.project = project
    requestWithProject.projectMembership = projectMembership
  }
}

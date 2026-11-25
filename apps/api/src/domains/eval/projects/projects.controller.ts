import { EvalProjectsRoutes, type MyProjectOutputDto } from "@bayes-platform/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "@/domains/projects/projects.service"

type Project = Awaited<ReturnType<ProjectsService["listUserProjects"]>>[number]

/** The projects the signed-in person can read, with their permissions on each. */
@Controller()
export class EvalProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /** A copy of `ProjectsController.listUserProjects`. */
  @SchemaRoute(EvalProjectsRoutes.getAllMine, { permission: "signed-in" })
  async getAllMine(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof EvalProjectsRoutes.getAllMine>> {
    const projects = await this.projectsService.listUserProjects(request.user.id)
    return { data: projects.map(toMyProjectDto) }
  }
}

function toMyProjectDto(project: Project): MyProjectOutputDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    permissions: project.permissions,
  }
}

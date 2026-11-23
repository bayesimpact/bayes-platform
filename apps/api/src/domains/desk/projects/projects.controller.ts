import { DeskProjectsRoutes } from "@caseai-connect/desk-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
import { toMyProjectDto } from "@/domains/projects/helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "@/domains/projects/projects.service"

/** The projects the signed-in person can read, with their permissions and feature flags. */
@Controller()
export class DeskProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @SchemaRoute(DeskProjectsRoutes.getAllMine, { permission: "signed-in" })
  async getAllMine(
    @Req() request: EndpointRequest,
  ): Promise<SchemaRouteResponse<typeof DeskProjectsRoutes.getAllMine>> {
    const projects = await this.projectsService.listUserProjects(request.user.id)
    return { data: projects.map(toMyProjectDto) }
  }
}

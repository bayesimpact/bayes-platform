import { ProjectsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequest,
  EndpointRequestWithOrganizationMembership,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { toMyProjectDto, toProjectDto } from "./helpers"
import { ProjectsGuard } from "./projects.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "./projects.service"

@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(ProjectsRoutes.getAllMine.path)
  @UseGuards(JwtAuthGuard, UserGuard)
  async listUserProjects(
    @Req() request: EndpointRequest,
  ): Promise<typeof ProjectsRoutes.getAllMine.response> {
    const projects = await this.projectsService.listUserProjects(request.user.id)
    return { data: projects.map(toMyProjectDto) }
  }

  @Post(ProjectsRoutes.createOne.path)
  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectsGuard)
  @RequireContext("organization")
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "project.create" })
  async createProject(
    @Req() request: EndpointRequestWithOrganizationMembership,
    @Body() body: typeof ProjectsRoutes.createOne.request,
  ): Promise<typeof ProjectsRoutes.createOne.response> {
    const project = await this.projectsService.createProject({
      organizationId: request.organizationId,
      name: body.payload.name,
      userId: request.user.id,
    })

    return { data: toProjectDto(project) }
  }

  @Get(ProjectsRoutes.getAll.path)
  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectsGuard)
  @RequireContext("organization")
  @CheckPolicy((policy) => policy.canList())
  async listProjects(
    @Req() request: EndpointRequestWithOrganizationMembership,
  ): Promise<typeof ProjectsRoutes.getAll.response> {
    const { organizationId, user } = request
    const projects = await this.projectsService.listProjects({ organizationId, userId: user.id })
    return { data: projects.map(toProjectDto) }
  }

  @Patch(ProjectsRoutes.updateOne.path)
  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectsGuard)
  @RequireContext("organization")
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("project")
  @TrackActivity({ action: "project.update", entityFrom: "project" })
  async updateProject(
    @Req() request: EndpointRequestWithProject,
    @Body() body: typeof ProjectsRoutes.updateOne.request,
  ): Promise<typeof ProjectsRoutes.updateOne.response> {
    const { project } = request

    const updatedProject = await this.projectsService.updateProject(project!, body.payload.name)

    return { data: toProjectDto(updatedProject) }
  }

  @Delete(ProjectsRoutes.deleteOne.path)
  @UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectsGuard)
  @RequireContext("organization")
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("project")
  @TrackActivity({ action: "project.delete", entityFrom: "project" })
  async deleteProject(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectsRoutes.deleteOne.response> {
    await this.projectsService.deleteProject(request.project)
    return { data: { success: true } }
  }
}

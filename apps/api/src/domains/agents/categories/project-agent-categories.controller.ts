import { ProjectAgentCategoriesRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { ProjectAgentCategoriesGuard } from "./project-agent-categories.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectAgentCategoriesService } from "./project-agent-categories.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectAgentCategoriesGuard)
@RequireContext("organization")
@Controller()
export class ProjectAgentCategoriesController {
  constructor(private readonly projectAgentCategoriesService: ProjectAgentCategoriesService) {}

  @Post(ProjectAgentCategoriesRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @AddContext("project")
  @TrackActivity({ action: "project.add_agent_category", entityFrom: "project" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() body: typeof ProjectAgentCategoriesRoutes.createOne.request,
  ): Promise<typeof ProjectAgentCategoriesRoutes.createOne.response> {
    const category = await this.projectAgentCategoriesService.addProjectAgentCategory(
      request.project!.id,
      body.payload.name,
    )
    return { data: { id: category.id, name: category.name } }
  }

  @Delete(ProjectAgentCategoriesRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("project")
  @TrackActivity({ action: "project.delete_agent_category", entityFrom: "project" })
  async deleteOne(
    @Req() request: EndpointRequestWithProject,
    @Param("categoryId") categoryId: string,
  ): Promise<typeof ProjectAgentCategoriesRoutes.deleteOne.response> {
    await this.projectAgentCategoriesService.deleteProjectAgentCategory(
      request.project!.id,
      categoryId,
    )
    return { data: { success: true } }
  }
}

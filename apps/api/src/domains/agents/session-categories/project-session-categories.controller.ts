import { ProjectSessionCategoriesRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { ProjectSessionCategoriesGuard } from "./project-session-categories.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectSessionCategoriesService } from "./project-session-categories.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectSessionCategoriesGuard)
@RequireContext("organization")
@Controller()
export class ProjectSessionCategoriesController {
  constructor(private readonly projectSessionCategoriesService: ProjectSessionCategoriesService) {}

  @Post(ProjectSessionCategoriesRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @AddContext("project")
  @TrackActivity({ action: "project.add_agent_session_category", entityFrom: "project" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() body: typeof ProjectSessionCategoriesRoutes.createOne.request,
  ): Promise<typeof ProjectSessionCategoriesRoutes.createOne.response> {
    const category = await this.projectSessionCategoriesService.addProjectSessionCategory(
      request.project!.id,
      body.payload.name,
      body.payload.assignToAllConversationalAgents,
    )
    return { data: { id: category.id, name: category.name } }
  }

  @Delete(ProjectSessionCategoriesRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("project")
  @TrackActivity({ action: "project.delete_agent_session_category", entityFrom: "project" })
  async deleteOne(
    @Req() request: EndpointRequestWithProject,
    @Param("categoryId") categoryId: string,
  ): Promise<typeof ProjectSessionCategoriesRoutes.deleteOne.response> {
    await this.projectSessionCategoriesService.deleteProjectSessionCategory(
      request.project!.id,
      categoryId,
    )
    return { data: { success: true } }
  }
}

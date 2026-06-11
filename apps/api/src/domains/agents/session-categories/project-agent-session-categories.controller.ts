import { ProjectAgentSessionCategoriesRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { ProjectAgentSessionCategoriesGuard } from "./project-agent-session-categories.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectAgentSessionCategoriesService } from "./project-agent-session-categories.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, ProjectAgentSessionCategoriesGuard)
@RequireContext("organization")
@Controller()
export class ProjectAgentSessionCategoriesController {
  constructor(
    private readonly projectAgentSessionCategoriesService: ProjectAgentSessionCategoriesService,
  ) {}

  @Post(ProjectAgentSessionCategoriesRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @AddContext("project")
  @TrackActivity({ action: "project.add_agent_session_category", entityFrom: "project" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() body: typeof ProjectAgentSessionCategoriesRoutes.createOne.request,
  ): Promise<typeof ProjectAgentSessionCategoriesRoutes.createOne.response> {
    const category = await this.projectAgentSessionCategoriesService.addProjectAgentSessionCategory(
      request.project!.id,
      body.payload.name,
      body.payload.assignToAllConversationalAgents,
    )
    return { data: { id: category.id, name: category.name } }
  }

  @Delete(ProjectAgentSessionCategoriesRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("project")
  @TrackActivity({ action: "project.delete_agent_session_category", entityFrom: "project" })
  async deleteOne(
    @Req() request: EndpointRequestWithProject,
    @Param("categoryId") categoryId: string,
  ): Promise<typeof ProjectAgentSessionCategoriesRoutes.deleteOne.response> {
    await this.projectAgentSessionCategoriesService.deleteProjectAgentSessionCategory(
      request.project!.id,
      categoryId,
    )
    return { data: { success: true } }
  }
}

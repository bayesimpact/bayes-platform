import { ProjectAgentSessionCategoriesRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_AGENT_SESSION_CATEGORY_CREATE_PERMISSION,
  PROJECT_AGENT_SESSION_CATEGORY_DELETE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectAgentSessionCategoriesService } from "./project-agent-session-categories.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization")
@Controller()
export class ProjectAgentSessionCategoriesController {
  constructor(
    private readonly projectAgentSessionCategoriesService: ProjectAgentSessionCategoriesService,
  ) {}

  @Post(ProjectAgentSessionCategoriesRoutes.createOne.path)
  @CheckPermission(PROJECT_AGENT_SESSION_CATEGORY_CREATE_PERMISSION, "project")
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
  @CheckPermission(PROJECT_AGENT_SESSION_CATEGORY_DELETE_PERMISSION, "project")
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

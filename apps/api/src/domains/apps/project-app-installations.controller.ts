import {
  type AppInstallationSummaryDto,
  ProjectAppInstallationsRoutes,
} from "@caseai-connect/api-contracts"
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_APP_INSTALLATION_READ_PERMISSION,
  PROJECT_APP_INSTALLATION_REVOKE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ActiveAppInstallationSummary } from "./app-installation.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

/** The studio view of a project's apps. Apps are installed through the OAuth consent page (ADR 0029). */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectAppInstallationsController {
  constructor(private readonly appsService: AppsService) {}

  @Get(ProjectAppInstallationsRoutes.getAll.path)
  @CheckPermission(PROJECT_APP_INSTALLATION_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectAppInstallationsRoutes.getAll.response> {
    const installations = await this.appsService.listActiveInstallations(request.project.id)
    return { data: installations.map(toAppInstallationSummaryDto) }
  }

  @Post(ProjectAppInstallationsRoutes.revokeOne.path)
  @HttpCode(HttpStatus.OK)
  @CheckPermission(PROJECT_APP_INSTALLATION_REVOKE_PERMISSION, "project")
  @TrackActivity({ action: "appInstallation.revoke", entityFrom: "appInstallation" })
  async revokeOne(
    @Req() request: EndpointRequestWithProject,
    @Param("appInstallationId") appInstallationId: string,
  ): Promise<typeof ProjectAppInstallationsRoutes.revokeOne.response> {
    const scope = await this.appsService.revokeInstallation({
      installationId: appInstallationId,
      userId: request.user.id,
      projectId: request.project.id,
    })
    attachTrackedActivity(request, {
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      entityFrom: "appInstallation",
      entityId: appInstallationId,
    })
    return { data: { success: true } }
  }
}

function toAppInstallationSummaryDto(
  installation: ActiveAppInstallationSummary,
): AppInstallationSummaryDto {
  return {
    id: installation.id,
    appName: installation.appName,
    description: installation.description,
    logoUrl: installation.logoUrl,
    permissions: installation.permissions,
    createdAt: installation.createdAt.getTime(),
  }
}

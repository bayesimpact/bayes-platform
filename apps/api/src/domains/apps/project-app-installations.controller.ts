import { ProjectAppInstallationsRoutes } from "@caseai-connect/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { PROJECT_APP_INSTALLATION_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"
import { toAppInstallationSummaryDto } from "./apps-install.controller"

/** The studio view of a project's apps. Installing and revoking stay on `app.install`. */
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
}

import { type AppCatalogEntryDto, ProjectAppCatalogRoutes } from "@caseai-connect/api-contracts"
import { Controller, ForbiddenException, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { PROJECT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { AppCatalogEntry } from "./apps.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

export const APPS_CATALOG_FEATURE_DISABLED_ERROR_MESSAGE =
  "The apps catalog is not enabled for this project"

/**
 * The apps a project can install, behind the apps-catalog flag. Every project member sees it:
 * the studio tells the ones who cannot install to ask an owner or admin.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectAppCatalogController {
  constructor(private readonly appsService: AppsService) {}

  @Get(ProjectAppCatalogRoutes.getAll.path)
  @CheckPermission(PROJECT_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof ProjectAppCatalogRoutes.getAll.response> {
    if (!(await this.appsService.isAppsCatalogEnabled(request.project.id))) {
      throw new ForbiddenException(APPS_CATALOG_FEATURE_DISABLED_ERROR_MESSAGE)
    }
    const entries = await this.appsService.listAppCatalog(request.project.id)
    return { data: entries.map(toAppCatalogEntryDto) }
  }
}

function toAppCatalogEntryDto(entry: AppCatalogEntry): AppCatalogEntryDto {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    logoUrl: entry.logoUrl,
    appUrl: entry.appUrl,
    installInstructions: entry.installInstructions,
    grantablePermissions: entry.grantablePermissions as AppCatalogEntryDto["grantablePermissions"],
    installed: entry.installed,
  }
}

import { AppsV1Routes } from "@caseai-connect/api-contracts"
import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AppGuard } from "./app.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@Controller()
export class AppsV1Controller {
  constructor(private readonly appsService: AppsService) {}

  @UseGuards(AppGuard)
  @Get(AppsV1Routes.getMe.path)
  async getMe(
    @Req() request: EndpointRequest & { appInstallationId: string; appProjectId: string },
  ): Promise<typeof AppsV1Routes.getMe.response> {
    const project = await this.appsService.describeInstalledProject(request.appProjectId)
    return {
      data: {
        userId: request.user.id,
        projectId: project.id,
        projectName: project.name,
        organizationId: project.organizationId,
        organizationName: project.organizationName,
        installationId: request.appInstallationId,
      },
    }
  }
}

import { AppsV1Routes } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AppGuard } from "./app.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@Controller()
export class AppsV1Controller {
  constructor(private readonly appsService: AppsService) {}

  @Post(AppsV1Routes.createToken.path)
  @HttpCode(HttpStatus.OK)
  async createToken(@Body() body: unknown): Promise<typeof AppsV1Routes.createToken.response> {
    const token = await this.appsService.issueToken(body)
    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
    }
  }

  @Post(AppsV1Routes.exchangeInstallCode.path)
  @HttpCode(HttpStatus.OK)
  async exchangeInstallCode(
    @Body() body: unknown,
  ): Promise<typeof AppsV1Routes.exchangeInstallCode.response> {
    const credentials = await this.appsService.exchangeInstallCode(body)
    return {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }
  }

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

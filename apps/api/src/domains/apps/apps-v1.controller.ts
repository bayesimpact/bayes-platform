import { AppsV1Routes } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AppGuard } from "./app.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppTokenRateLimiter } from "./app-token-rate-limiter"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@Controller()
export class AppsV1Controller {
  constructor(
    private readonly appsService: AppsService,
    private readonly appTokenRateLimiter: AppTokenRateLimiter,
  ) {}

  @Post(AppsV1Routes.createToken.path)
  @HttpCode(HttpStatus.OK)
  async createToken(
    @Req() request: { ip?: string },
    @Body() body: unknown,
  ): Promise<typeof AppsV1Routes.createToken.response> {
    this.appTokenRateLimiter.consume(request.ip ?? "unknown")
    const token = await this.appsService.issueToken(body)
    return { data: token }
  }

  @UseGuards(AppGuard)
  @Get(AppsV1Routes.getMe.path)
  getMe(
    @Req() request: EndpointRequest & { appInstallationId: string; appProjectId: string },
  ): typeof AppsV1Routes.getMe.response {
    return {
      data: {
        userId: request.user.id,
        projectId: request.appProjectId,
        installationId: request.appInstallationId,
      },
    }
  }
}

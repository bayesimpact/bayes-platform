import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { getAccessToken } from "@/common/utils/get-access-token"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@Injectable()
export class AppGuard implements CanActivate {
  constructor(private readonly appsService: AppsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as EndpointRequest & {
      appInstallationId?: string
      appProjectId?: string
    }
    const accessToken = getAccessToken(request.headers?.authorization)

    try {
      const principal = await this.appsService.resolveAppPrincipal(accessToken)
      request.user = principal.user
      request.appInstallationId = principal.installationId
      request.appProjectId = principal.projectId
      return true
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_ACCESS_TOKEN)
    }
  }
}

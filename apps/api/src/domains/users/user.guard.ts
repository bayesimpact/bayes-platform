import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import type { JwtPayload } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { getAccessToken } from "@/common/utils/get-access-token"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Auth0UserInfoService } from "@/domains/auth/auth0-userinfo.service"
import { isServiceAuth0Id, isServiceUser } from "@/domains/users/service-user.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"

@Injectable()
export class UserGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly auth0UserInfoService: Auth0UserInfoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    const accessToken = getAccessToken(request.headers.authorization)
    if (!accessToken) {
      throw new UnauthorizedException(AUTH_ERRORS.NO_ACCESS_TOKEN)
    }

    const jwtPayload: JwtPayload = request.user

    if (!jwtPayload || !jwtPayload.sub) {
      throw new UnauthorizedException(AUTH_ERRORS.SUB_NOT_FOUND)
    }

    if (isServiceAuth0Id(jwtPayload.sub)) {
      throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
    }

    try {
      const user = await this.usersService.findOrCreate({
        sub: jwtPayload.sub,
        getUserInfo: () => this.auth0UserInfoService.getUserInfo(accessToken),
      })

      if (isServiceUser(user)) {
        throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
      }

      request.jwtPayload = jwtPayload
      request.user = user

      return true
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND, error as Error)
    }
  }
}

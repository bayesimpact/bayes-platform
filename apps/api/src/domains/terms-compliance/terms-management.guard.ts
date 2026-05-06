import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { isEmailBackofficeAuthorized } from "@/domains/backoffice/backoffice.authorization"

@Injectable()
export class TermsManagementGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<EndpointRequest>()
    const user = request.user

    if (!user || !isEmailBackofficeAuthorized(user.email)) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }
    return true
  }
}

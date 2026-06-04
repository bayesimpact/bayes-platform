import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequestWithOrganizationMembership } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { CHECK_POLICY_KEY } from "@/common/policies/check-policy.decorator"
import { OrganizationPolicy } from "./organization.policy"

@Injectable()
export class OrganizationsPolicyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as EndpointRequestWithOrganizationMembership
    const policy = new OrganizationPolicy(request.user, request.organizationMembership ?? null)

    const policyHandler = this.reflector.getAllAndOverride<
      ((policy: OrganizationPolicy) => boolean) | undefined
    >(CHECK_POLICY_KEY, [context.getHandler(), context.getClass()])

    if (!policyHandler) {
      return true
    }

    if (!policyHandler(policy)) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    return true
  }
}

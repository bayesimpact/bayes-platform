import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequestWithMemberGrantScope } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { CHECK_POLICY_KEY, type PolicyHandler } from "@/common/policies/check-policy.decorator"
import { requestToProjectPolicyContext } from "@/domains/projects/helpers"
import { MemberGrantPolicy } from "./member-grant.policy"
import { isMemberGrantTargetType } from "./member-grant.types"

@Injectable()
export class MemberGrantsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // MemberGrantScopeContextResolver has already loaded the project context, the target
    // and (for agent targets) the caller's agent membership.
    const request = context.switchToHttp().getRequest() as EndpointRequestWithMemberGrantScope & {
      body?: { payload?: { targetType?: string } }
    }
    const rawTargetType = request.body?.payload?.targetType
    const targetType =
      rawTargetType && isMemberGrantTargetType(rawTargetType) ? rawTargetType : undefined

    const policy = new MemberGrantPolicy(
      {
        ...requestToProjectPolicyContext(request),
        agentMembership: request.memberGrantAgentMembership,
      },
      request.memberGrantTarget,
      targetType,
    )

    const policyHandler = this.reflector.getAllAndOverride<PolicyHandler>(CHECK_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!policyHandler || !policyHandler(policy)) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    return true
  }
}

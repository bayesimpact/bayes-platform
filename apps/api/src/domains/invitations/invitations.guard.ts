import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequestWithInvitationScope } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { CHECK_POLICY_KEY, type PolicyHandler } from "@/common/policies/check-policy.decorator"
import { requestToProjectPolicyContext } from "@/domains/projects/helpers"
import { InvitationPolicy } from "./invitation.policy"
import { isInvitationTargetType } from "./invitation.types"

@Injectable()
export class InvitationsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // InvitationScopeContextResolver has already loaded the project context, the target,
    // the invitation (for routes with :invitationId) and, for agent targets, the caller's
    // agent membership.
    const request = context.switchToHttp().getRequest() as EndpointRequestWithInvitationScope & {
      body?: { payload?: { targetType?: string } }
      query?: { targetType?: string }
    }
    const rawTargetType =
      request.invitation?.targetType ??
      request.body?.payload?.targetType ??
      request.query?.targetType
    const targetType =
      rawTargetType && isInvitationTargetType(rawTargetType) ? rawTargetType : undefined

    const policy = new InvitationPolicy(
      {
        ...requestToProjectPolicyContext(request),
        agentMembership: request.invitationAgentMembership,
      },
      request.invitationTarget,
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

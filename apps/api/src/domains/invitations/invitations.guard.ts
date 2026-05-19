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
import type { InvitationTargetType } from "./invitation.entity"
import { InvitationPolicy } from "./invitation.policy"

@Injectable()
export class InvitationsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // InvitationScopeContextResolver has already loaded project context, the target entity,
    // and (for agent targets) the caller's agent membership.
    const request = context.switchToHttp().getRequest() as EndpointRequestWithInvitationScope

    const targetType = this.resolveTargetType(request)

    const policy = new InvitationPolicy(
      {
        ...requestToProjectPolicyContext(request),
        agentMembership: request.invitationAgentMembership,
      },
      request.invitation,
      targetType,
      request.invitationTarget,
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

  private resolveTargetType(
    request: EndpointRequestWithInvitationScope & {
      body?: { payload?: { targetType?: string } }
      query?: Record<string, string | undefined>
    },
  ): InvitationTargetType | undefined {
    const raw =
      request.invitation?.targetType ??
      request.body?.payload?.targetType ??
      request.query?.targetType

    if (raw === "project" || raw === "agent" || raw === "review_campaign") return raw
    return undefined
  }
}

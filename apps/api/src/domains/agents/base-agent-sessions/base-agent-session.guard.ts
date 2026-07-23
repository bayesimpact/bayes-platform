import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { CHECK_POLICY_KEY, type PolicyHandler } from "@/common/policies/check-policy.decorator"
import { requestToProjectPolicyContext } from "@/domains/projects/helpers"
import type { ConversationAgentSession } from "../conversation-agent-sessions/conversation-agent-session.entity"
import type { ExtractionAgentSession } from "../extraction-agent-sessions/extraction-agent-session.entity"
import { BaseAgentSessionPolicy } from "./base-agent-session.policy"

@Injectable()
export class BaseAgentSessionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as EndpointRequestWithAgentSession<
      ConversationAgentSession | ExtractionAgentSession
    >

    const body = "body" in request && typeof request.body === "object" ? request.body : undefined
    if (!body) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }
    const payload = "payload" in body && typeof body.payload === "object" ? body.payload : undefined
    if (!payload) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }
    const type = "type" in payload && typeof payload.type === "string" ? payload.type : undefined
    if (!type || (type !== "live" && type !== "playground")) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    const policy = new BaseAgentSessionPolicy(
      requestToProjectPolicyContext(request),
      request.agentSession,
      type,
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

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { CHECK_POLICY_KEY, type PolicyHandler } from "@/common/policies/check-policy.decorator"
import { requestToProjectPolicyContext } from "@/domains/projects/helpers"
import { ExtractionAgentDocumentPolicy } from "./extraction-agent-document.policy"

/**
 * Evaluates `@CheckPolicy` against `ExtractionAgentDocumentPolicy`. The run type comes from
 * `payload.type`, as for `BaseAgentSessionGuard`, so the routes it protects are all POST.
 */
@Injectable()
export class ExtractionAgentDocumentsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as EndpointRequestWithAgent

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

    const policy = new ExtractionAgentDocumentPolicy(
      requestToProjectPolicyContext(request),
      undefined,
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

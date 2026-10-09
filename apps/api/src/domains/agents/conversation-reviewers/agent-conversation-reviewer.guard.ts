import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentConversationReviewersService } from "./agent-conversation-reviewers.service"

/**
 * Lets through the people granted the safety review of the agent on the request. Runs after
 * `ResourceContextGuard`, which puts the agent there. No role, global or scoped, stands in for it.
 */
@Injectable()
export class AgentConversationReviewerGuard implements CanActivate {
  constructor(
    private readonly agentConversationReviewersService: AgentConversationReviewersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EndpointRequestWithAgent>()
    const isReviewer = await this.agentConversationReviewersService.isReviewer({
      userId: request.user.id,
      agentId: request.agent.id,
    })
    if (!isReviewer) throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    return true
  }
}

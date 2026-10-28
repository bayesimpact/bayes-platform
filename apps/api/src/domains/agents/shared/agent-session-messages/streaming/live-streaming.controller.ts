import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Req,
  RequestMethod,
  Sse,
  UseGuards,
} from "@nestjs/common"
import type { Observable } from "rxjs"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AGENT_CONVERSATION_SESSION_CREATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { StreamingController } from "./streaming.controller"

const Routes = AgentSessionMessagesRoutes.live

/**
 * Sends a message to a live session and streams the reply. Open to every project role through
 * `agent.conversation.session.create`.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class LiveStreamingController extends StreamingController {
  protected readonly type = "live"

  @Sse(Routes.stream.path, { method: RequestMethod.POST })
  @HttpCode(HttpStatus.OK)
  @CheckPermission(AGENT_CONVERSATION_SESSION_CREATE_PERMISSION, "project")
  stream(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Body() body: typeof Routes.stream.request,
  ): Observable<MessageEvent> {
    return this.handleStream(request, body)
  }
}

import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import { Controller, Query, Req, Sse, UseGuards } from "@nestjs/common"
import type { Observable } from "rxjs"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AGENT_CONVERSATION_SESSION_PLAYGROUND_CREATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { StreamingController } from "./streaming.controller"

const Routes = AgentSessionMessagesRoutes.playground

/**
 * Sends a message to a playground session and streams the reply. Playground sessions belong to
 * Studio: `agent.conversation.session.playground.create` keeps them to project owners and admins.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class PlaygroundStreamingController extends StreamingController {
  protected readonly type = "playground"

  @Sse(Routes.stream.path, { method: 0 /* GET */ })
  @CheckPermission(AGENT_CONVERSATION_SESSION_PLAYGROUND_CREATE_PERMISSION, "project")
  stream(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    return this.handleStream(request, query)
  }
}

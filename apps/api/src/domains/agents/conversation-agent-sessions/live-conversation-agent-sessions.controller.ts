import { ConversationAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import { Controller, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_CONVERSATION_SESSION_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_DELETE_PERMISSION,
  AGENT_CONVERSATION_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ConversationAgentSession } from "./conversation-agent-session.entity"
import { ConversationAgentSessionsController } from "./conversation-agent-sessions.controller"

const Routes = ConversationAgentSessionsRoutes.live

/** Live conversation sessions, open to every project role through the `agent.conversation.session.*` keys. */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class LiveConversationAgentSessionsController extends ConversationAgentSessionsController {
  protected readonly type = "live"

  @Post(Routes.getAll.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_READ_PERMISSION, "project")
  getAll(@Req() request: EndpointRequestWithAgent): Promise<typeof Routes.getAll.response> {
    return this.handleGetAll(request)
  }

  @Post(Routes.createOne.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "conversationAgentSession.create" })
  createOne(@Req() request: EndpointRequestWithAgent): Promise<typeof Routes.createOne.response> {
    return this.handleCreateOne(request)
  }

  @Post(Routes.deleteOne.path)
  @AddContext("agentSession")
  @CheckPermission(AGENT_CONVERSATION_SESSION_DELETE_PERMISSION, "project")
  deleteOne(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<typeof Routes.deleteOne.response> {
    return this.handleDeleteOne(request)
  }

  @Post(Routes.listSubSessions.path)
  @AddContext("agentSession")
  @CheckPermission(AGENT_CONVERSATION_SESSION_READ_PERMISSION, "project")
  listSubSessions(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<typeof Routes.listSubSessions.response> {
    return this.handleListSubSessions(request)
  }
}

import { AgentSessionMessagesRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_CONVERSATION_SESSION_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { AgentMessagesController } from "./agent-messages.controller"

const Routes = AgentSessionMessagesRoutes.live

/** Messages of live sessions, open to every project role through the `agent.conversation.session.*` keys. */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class LiveAgentMessagesController extends AgentMessagesController {
  protected readonly type = "live"

  @Post(Routes.getAll.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_READ_PERMISSION, "project")
  getAll(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<typeof Routes.getAll.response> {
    return this.handleGetAll(request)
  }

  @Post(Routes.getMcpAppHtml.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_READ_PERMISSION, "project")
  getMcpAppHtml(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<typeof Routes.getMcpAppHtml.response> {
    return this.handleGetMcpAppHtml(request)
  }

  @Post(Routes.getOne.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_READ_PERMISSION, "project")
  getOne(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Param("messageId") messageId: string,
  ): Promise<typeof Routes.getOne.response> {
    return this.handleGetOne(request, messageId)
  }

  @Post(Routes.presignAttachmentDocument.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_CREATE_PERMISSION, "project")
  @HttpCode(HttpStatus.CREATED)
  presignAttachmentDocument(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Body() { payload }: typeof Routes.presignAttachmentDocument.request,
  ): Promise<typeof Routes.presignAttachmentDocument.response> {
    return this.handlePresignAttachmentDocument(request, payload)
  }

  @Post(Routes.getAttachmentDocumentTemporaryUrl.path)
  @CheckPermission(AGENT_CONVERSATION_SESSION_READ_PERMISSION, "project")
  getAttachmentDocumentTemporaryUrl(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Param("attachmentDocumentId") attachmentDocumentId: string,
  ): Promise<typeof Routes.getAttachmentDocumentTemporaryUrl.response> {
    return this.handleGetAttachmentDocumentTemporaryUrl(request, attachmentDocumentId)
  }
}

import {
  type ConversationReviewDto,
  type ConversationReviewMessageDto,
  ConversationReviewRoutes,
} from "@caseai-connect/api-contracts"
import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AGENT_CONVERSATION_REVIEW_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import type { ConversationReview } from "./conversation-review.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationReviewService } from "./conversation-review.service"

/**
 * Safety review of an agent's conversations. Past the organization membership every Studio route
 * needs, the global `agent.conversation.review` permission is the only gate: no project or agent
 * membership is needed, and no policy applies. Every read is logged in the activity journal with
 * the session it opened.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class ConversationReviewController {
  constructor(private readonly conversationReviewService: ConversationReviewService) {}

  @Get(ConversationReviewRoutes.getOne.path)
  @CheckPermission(AGENT_CONVERSATION_REVIEW_PERMISSION)
  @TrackActivity({ action: "agent.conversation.review", entityFrom: "agentSession" })
  async getOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("agentSessionId", new ParseUUIDPipe()) agentSessionId: string,
  ): Promise<typeof ConversationReviewRoutes.getOne.response> {
    const review = await this.conversationReviewService.getConversationForReview({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      sessionId: agentSessionId,
    })
    attachTrackedActivity(request, { entityFrom: "agentSession", entityId: review.session.id })
    return { data: toConversationReviewDto(review) }
  }
}

function toConversationReviewDto({ session, messages }: ConversationReview): ConversationReviewDto {
  return {
    sessionId: session.id,
    agentId: session.agentId,
    type: session.type,
    ...(session.title ? { title: session.title } : {}),
    isSubSession: session.isSubSession,
    isPurged: session.purgedAt !== null,
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    messages: messages.map(toConversationReviewMessageDto),
  }
}

function toConversationReviewMessageDto(message: AgentMessage): ConversationReviewMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    ...(message.status ? { status: message.status } : {}),
    toolNames: (message.toolCalls ?? []).map((toolCall) => toolCall.name),
    createdAt: message.createdAt.getTime(),
  }
}

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
 * Safety review of an agent's sessions, of any kind. Past the organization membership every Studio route
 * needs, the only gate is `agent.conversation.review`, held by the `agent_conversation_reviewer`
 * role on the agent and by nothing else: no parent passes it down. Every read is logged in the
 * activity journal with the session it opened.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class ConversationReviewController {
  constructor(private readonly conversationReviewService: ConversationReviewService) {}

  @Get(ConversationReviewRoutes.getOne.path)
  @CheckPermission(AGENT_CONVERSATION_REVIEW_PERMISSION, "agent")
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

function toConversationReviewDto(review: ConversationReview): ConversationReviewDto {
  const { session, messages } = review
  const common = {
    sessionId: session.id,
    agentId: session.agentId,
    kind: review.kind,
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    messages: messages.map(toConversationReviewMessageDto),
  }

  switch (review.kind) {
    case "conversation":
      return {
        ...common,
        type: review.session.type,
        ...(review.session.title ? { title: review.session.title } : {}),
        isSubSession: review.session.isSubSession,
        isPurged: review.session.purgedAt !== null,
      }
    case "public":
      return {
        ...common,
        channel: review.session.appInstallationId ? "app" : "embed",
        ...(review.session.externalVisitorId
          ? { externalVisitorId: review.session.externalVisitorId }
          : {}),
        ...(review.session.title ? { title: review.session.title } : {}),
        isSubSession: false,
        isPurged: review.session.purgedAt !== null,
      }
    case "extraction":
      return {
        ...common,
        type: review.session.type,
        extraction: {
          status: review.session.status,
          documentTitle: review.session.document.title,
          ...(review.session.result ? { result: review.session.result } : {}),
          ...(review.session.errorCode ? { errorCode: review.session.errorCode } : {}),
        },
        isSubSession: false,
        // Extraction runs are outside the retention sweep.
        isPurged: false,
      }
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

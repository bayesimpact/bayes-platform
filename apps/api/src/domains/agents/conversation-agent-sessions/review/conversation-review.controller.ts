import {
  CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY,
  type ConversationReviewDto,
  type ConversationReviewMessageDto,
  ConversationReviewRoutes,
  type ConversationReviewSessionRowDto,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_CONVERSATION_REVIEW_CATEGORY_READ_PERMISSION,
  AGENT_CONVERSATION_REVIEW_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { AgentMessage } from "../../shared/agent-session-messages/agent-message.entity"
import type { ReviewSessionListRow } from "./conversation-review.repository"
import type { ConversationReview } from "./conversation-review.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationReviewService } from "./conversation-review.service"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Safety review of an agent's sessions, of any kind. Past the organization membership every Studio route
 * needs, the only gates are the two review permissions, both held by the `agent_conversation_reviewer`
 * role on the agent and by nothing else: no parent passes them down. `agent.conversation.review`
 * opens one session from its id; `agent.conversation.review.category.read` lists the sessions by
 * category to pick from. Every opened session is logged in the activity journal.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class ConversationReviewController {
  constructor(private readonly conversationReviewService: ConversationReviewService) {}

  /**
   * The agent's sessions grouped by category: the conversation sessions and the public
   * embed/app sessions a category tagged, or the ones no category tagged. Newest first,
   * paginated. The rows carry no content: the reviewer opens a session from its row, which
   * is the read logged in the activity journal.
   *
   * Declared before `getOne`: the same path prefix with the literal `sessions` would
   * otherwise match its `:agentSessionId` slot and fail the UUID pipe.
   */
  @Get(ConversationReviewRoutes.listSessions.path)
  @CheckPermission(AGENT_CONVERSATION_REVIEW_CATEGORY_READ_PERMISSION, "agent")
  async listSessions(
    @Req() request: EndpointRequestWithAgent,
    @Query("categoryId") categoryIdParam?: string,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
  ): Promise<typeof ConversationReviewRoutes.listSessions.response> {
    const categoryId = toReviewCategoryId(categoryIdParam)
    const page = Math.max(1, Number(pageParam) || 1)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 20))
    const reviewPage = await this.conversationReviewService.listSessionsForReview({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      categoryId,
      page,
      limit,
    })
    return {
      data: {
        sessions: reviewPage.rows.map(toConversationReviewSessionRowDto),
        total: reviewPage.total,
        page,
        limit,
      },
    }
  }

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

/** A project category id, or null for the sessions no category tagged. */
function toReviewCategoryId(value: string | undefined): string | null {
  if (value === undefined || value === "") {
    throw new BadRequestException("categoryId is required")
  }
  if (value === CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY) return null
  if (!UUID_REGEX.test(value)) {
    throw new BadRequestException("categoryId must be a category id")
  }
  return value
}

function toConversationReviewSessionRowDto(
  row: ReviewSessionListRow,
): ConversationReviewSessionRowDto {
  return {
    sessionId: row.sessionId,
    kind: row.kind,
    ...(row.kind === "conversation" && row.conversationType
      ? { conversationType: row.conversationType }
      : {}),
    isSubSession: row.isSubSession,
    ...(row.kind === "public" && row.channel ? { channel: row.channel } : {}),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    createdAt: row.createdAt.getTime(),
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

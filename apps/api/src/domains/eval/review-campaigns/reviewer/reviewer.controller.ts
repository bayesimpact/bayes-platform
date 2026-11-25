import { EvalReviewerRoutes } from "@caseai-connect/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type {
  EndpointRequestWithAgentSessionInCampaign,
  EndpointRequestWithReviewCampaign,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
import { toMcpAppHtmlDtos } from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpAppHtmlService } from "@/domains/agents/shared/agent-session-messages/mcp-app-html.service"
import {
  REVIEW_CAMPAIGN_REVIEWER_REVIEW_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_REVIEWER_REVIEW_UPDATE_PERMISSION,
  REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewerService } from "@/domains/review-campaigns/reviewer/reviewer.service"
import {
  toReviewerReviewDto,
  toReviewerSessionDto,
  toReviewerSessionListItemDto,
} from "./reviewer.mappers"

/**
 * What a reviewer does in a campaign: the list of its sessions, a session with its MCP Apps, and
 * the reviews. A route with a session reads the campaign from the session and ignores
 * `:reviewCampaignId`.
 */
@Controller()
export class EvalReviewerController {
  constructor(
    private readonly reviewerService: ReviewerService,
    private readonly mcpAppHtmlService: McpAppHtmlService,
  ) {}

  @SchemaRoute(EvalReviewerRoutes.getSessions, {
    permission: { key: REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "reviewCampaign"],
  })
  async getSessions(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewerRoutes.getSessions>> {
    const summaries = await this.reviewerService.listSessionsForCampaign({
      campaign: request.reviewCampaign,
      reviewerUserId: request.user.id,
    })
    return { data: { sessions: summaries.map(toReviewerSessionListItemDto) } }
  }

  @SchemaRoute(EvalReviewerRoutes.getSession, {
    permission: { key: REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "agentSessionInCampaign"],
  })
  async getSession(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewerRoutes.getSession>> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    const result = await this.reviewerService.getSessionForReview({
      campaign: request.reviewCampaign,
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
    })
    return { data: toReviewerSessionDto(result) }
  }

  /**
   * The current HTML of the session's MCP Apps, for the reviewer to read the replies as the tester
   * did. Apart from the session: reading it connects to the MCP servers the transcript points at.
   */
  @SchemaRoute(EvalReviewerRoutes.getSessionMcpAppHtml, {
    permission: { key: REVIEW_CAMPAIGN_REVIEWER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "agentSessionInCampaign"],
  })
  async getSessionMcpAppHtml(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalReviewerRoutes.getSessionMcpAppHtml>> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    const { transcript } = await this.reviewerService.getSessionForReview({
      campaign: request.reviewCampaign,
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
    })
    const htmlByKey = await this.mcpAppHtmlService.readLiveHtml({
      agentId: request.reviewCampaign.agentId,
      sessionId,
      messages: transcript,
    })
    return { data: toMcpAppHtmlDtos(htmlByKey) }
  }

  /** The schema refuses a rating that is missing or outside 1 to 5 (422 before) and a missing comment or list of answers. */
  @SchemaRoute(EvalReviewerRoutes.createReview, {
    permission: { key: REVIEW_CAMPAIGN_REVIEWER_REVIEW_CREATE_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "agentSessionInCampaign"],
  })
  async createReview(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalReviewerRoutes.createReview>,
  ): Promise<SchemaRouteResponse<typeof EvalReviewerRoutes.createReview>> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    const review = await this.reviewerService.submitReview({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
      fields: payload,
    })
    return { data: toReviewerReviewDto(review) }
  }

  @SchemaRoute(EvalReviewerRoutes.updateReview, {
    permission: { key: REVIEW_CAMPAIGN_REVIEWER_REVIEW_UPDATE_PERMISSION, on: "review_campaign" },
    context: ["organization", "project", "agentSessionInCampaign"],
  })
  async updateReview(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
    @RouteInput() { params, payload }: SchemaRouteInput<typeof EvalReviewerRoutes.updateReview>,
  ): Promise<SchemaRouteResponse<typeof EvalReviewerRoutes.updateReview>> {
    const { sessionId, userId } = request.agentSessionInCampaign
    const review = await this.reviewerService.updateReview({
      campaign: request.reviewCampaign,
      reviewId: params.reviewId,
      sessionId,
      sessionOwnerUserId: userId,
      reviewerUserId: request.user.id,
      fields: payload,
    })
    return { data: toReviewerReviewDto(review) }
  }
}

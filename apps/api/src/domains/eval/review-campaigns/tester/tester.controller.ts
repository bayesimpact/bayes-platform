import { EvalTesterRoutes } from "@bayes-platform/eval-contracts"
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
import {
  REVIEW_CAMPAIGN_TESTER_FEEDBACK_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SESSION_DELETE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SURVEY_CREATE_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SURVEY_READ_PERMISSION,
  REVIEW_CAMPAIGN_TESTER_SURVEY_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TesterService } from "@/domains/review-campaigns/tester/tester.service"
import { toTesterFeedbackDto, toTesterSessionDto, toTesterSurveyDto } from "./tester.mappers"

const CAMPAIGN_CONTEXT = ["organization", "project", "reviewCampaign"] as const

/** The session's campaign, which the permission is checked on. The path names no campaign. */
const SESSION_CONTEXT = ["organization", "project", "agentSessionInCampaign"] as const

/**
 * What a tester does in a campaign: their sessions, their feedback on a session and their survey.
 * The service checks that the campaign is active, that the session is the caller's (404
 * otherwise) and that a feedback or a survey is given once (409).
 */
@Controller()
export class EvalTesterController {
  constructor(private readonly testerService: TesterService) {}

  @SchemaRoute(EvalTesterRoutes.getSessions, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_READ_PERMISSION, on: "review_campaign" },
    context: [...CAMPAIGN_CONTEXT],
  })
  async getSessions(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.getSessions>> {
    const summaries = await this.testerService.listMyTesterSessions({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      campaign: request.reviewCampaign,
    })
    return { data: { sessions: summaries.map(toTesterSessionDto) } }
  }

  /** The schema refuses a body with any key: the campaign gives the session its agent. */
  @SchemaRoute(EvalTesterRoutes.startSession, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION, on: "review_campaign" },
    context: [...CAMPAIGN_CONTEXT],
  })
  async startSession(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.startSession>> {
    const { id } = await this.testerService.startSession({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
      userId: request.user.id,
    })
    return { data: { id } }
  }

  @SchemaRoute(EvalTesterRoutes.getSurvey, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SURVEY_READ_PERMISSION, on: "review_campaign" },
    context: [...CAMPAIGN_CONTEXT],
  })
  async getSurvey(
    @Req() request: EndpointRequestWithReviewCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.getSurvey>> {
    const survey = await this.testerService.getMyTesterSurvey({
      userId: request.user.id,
      campaign: request.reviewCampaign,
    })
    return { data: { survey: survey ? toTesterSurveyDto(survey) : null } }
  }

  /** The schema refuses a rating that is missing or outside 1 to 5 (422 before) and a missing comment or list of answers. */
  @SchemaRoute(EvalTesterRoutes.createSurvey, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SURVEY_CREATE_PERMISSION, on: "review_campaign" },
    context: [...CAMPAIGN_CONTEXT],
  })
  async createSurvey(
    @Req() request: EndpointRequestWithReviewCampaign,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalTesterRoutes.createSurvey>,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.createSurvey>> {
    const survey = await this.testerService.submitSurvey({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
      userId: request.user.id,
      fields: payload,
    })
    return { data: toTesterSurveyDto(survey) }
  }

  /** The schema requires the rating, the comment and the answers, where any one was enough. */
  @SchemaRoute(EvalTesterRoutes.updateSurvey, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SURVEY_UPDATE_PERMISSION, on: "review_campaign" },
    context: [...CAMPAIGN_CONTEXT],
  })
  async updateSurvey(
    @Req() request: EndpointRequestWithReviewCampaign,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalTesterRoutes.updateSurvey>,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.updateSurvey>> {
    const survey = await this.testerService.updateSurvey({
      campaign: request.reviewCampaign,
      userId: request.user.id,
      fields: payload,
    })
    return { data: toTesterSurveyDto(survey) }
  }

  /** The schema refuses a rating that is missing or outside 1 to 5 (422 before) and a missing comment or list of answers. */
  @SchemaRoute(EvalTesterRoutes.createFeedback, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_FEEDBACK_CREATE_PERMISSION, on: "review_campaign" },
    context: [...SESSION_CONTEXT],
  })
  async createFeedback(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalTesterRoutes.createFeedback>,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.createFeedback>> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    const feedback = await this.testerService.submitFeedback({
      connectScope: getRequiredConnectScope(request),
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      campaign: request.reviewCampaign,
      callerUserId: request.user.id,
      fields: payload,
    })
    return { data: toTesterFeedbackDto(feedback) }
  }

  @SchemaRoute(EvalTesterRoutes.deleteSession, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_DELETE_PERMISSION, on: "review_campaign" },
    context: [...SESSION_CONTEXT],
  })
  async deleteSession(
    @Req() request: EndpointRequestWithAgentSessionInCampaign,
  ): Promise<SchemaRouteResponse<typeof EvalTesterRoutes.deleteSession>> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    await this.testerService.deleteTesterSession({
      campaign: request.reviewCampaign,
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      callerUserId: request.user.id,
    })
    return { data: { success: true } }
  }
}

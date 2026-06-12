import {
  type ListMyReviewCampaignsResponseDto,
  type MyTesterSessionSummaryDto,
  ReviewCampaignsRoutes,
  type ReviewCampaignTesterContextDto,
  type TesterCampaignSurveyDto,
  type TesterSessionFeedbackDto,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type {
  EndpointRequest,
  EndpointRequestWithAgentSessionInCampaign,
  EndpointRequestWithReviewCampaignMembership,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CaslAbilityGuard } from "@/common/policies/casl-ability.guard"
import { CheckAbility } from "@/common/policies/check-ability.decorator"
import type { Agent } from "@/domains/agents/agent.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { TesterCampaignSurvey } from "../tester-campaign-surveys/tester-campaign-survey.entity"
import type { TesterSessionFeedback } from "../tester-session-feedbacks/tester-session-feedback.entity"
import type { MyTesterSessionSummary } from "./tester.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TesterService } from "./tester.service"

@UseGuards(JwtAuthGuard, UserGuard)
@Controller()
export class TesterMeController {
  constructor(private readonly testerService: TesterService) {}

  @Get(ReviewCampaignsRoutes.getMyReviewCampaigns.path)
  async getMyReviewCampaigns(
    @Req() request: EndpointRequest,
    @Query("role") roleParam?: string,
  ): Promise<typeof ReviewCampaignsRoutes.getMyReviewCampaigns.response> {
    const role = parseRoleQuery(roleParam)
    const campaigns = await this.testerService.listMyCampaigns(request.user.id, role)
    return { data: { reviewCampaigns: campaigns.map(toMyCampaignDto) } }
  }
}

function parseRoleQuery(role: string | undefined): "tester" | "reviewer" {
  if (role === undefined) return "tester"
  if (role === "tester" || role === "reviewer") return role
  throw new BadRequestException(`Invalid role filter: ${role} (expected "tester" or "reviewer")`)
}

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CaslAbilityGuard)
@RequireContext("organization", "project", "reviewCampaign", "reviewCampaignMembership")
@Controller()
export class TesterController {
  constructor(private readonly testerService: TesterService) {}

  @Get(ReviewCampaignsRoutes.getTesterContext.path)
  @CheckAbility(
    "viewSharedContext",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async getTesterContext(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.getTesterContext.response> {
    const agent = await this.testerService.getAgentForCampaign({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
    })
    return { data: toTesterContextDto(request.reviewCampaign, agent) }
  }

  @Get(ReviewCampaignsRoutes.listMyTesterSessions.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async listMyTesterSessions(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.listMyTesterSessions.response> {
    const summaries = await this.testerService.listMyTesterSessions({
      userId: request.user.id,
      campaignId: request.reviewCampaign.id,
    })
    return { data: { sessions: summaries.map(toMyTesterSessionSummaryDto) } }
  }

  @Post(ReviewCampaignsRoutes.startTesterSession.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async startTesterSession(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
    @Body() { payload }: typeof ReviewCampaignsRoutes.startTesterSession.request,
  ): Promise<typeof ReviewCampaignsRoutes.startTesterSession.response> {
    const result = await this.testerService.startSession({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
      userId: request.user.id,
      type: payload.type,
    })
    return { data: result }
  }

  @Post(ReviewCampaignsRoutes.submitTesterSurvey.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async submitTesterSurvey(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
    @Body() { payload }: typeof ReviewCampaignsRoutes.submitTesterSurvey.request,
  ): Promise<typeof ReviewCampaignsRoutes.submitTesterSurvey.response> {
    const survey = await this.testerService.submitSurvey({
      connectScope: getRequiredConnectScope(request),
      campaign: request.reviewCampaign,
      userId: request.user.id,
      fields: payload,
    })
    return { data: toSurveyDto(survey) }
  }

  @Patch(ReviewCampaignsRoutes.updateTesterSurvey.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async updateTesterSurvey(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
    @Body() { payload }: typeof ReviewCampaignsRoutes.updateTesterSurvey.request,
  ): Promise<typeof ReviewCampaignsRoutes.updateTesterSurvey.response> {
    const survey = await this.testerService.updateSurvey({
      campaign: request.reviewCampaign,
      userId: request.user.id,
      fields: payload,
    })
    return { data: toSurveyDto(survey) }
  }

  @Get(ReviewCampaignsRoutes.getMyTesterSurvey.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async getMyTesterSurvey(
    @Req() request: EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.getMyTesterSurvey.response> {
    const survey = await this.testerService.getMyTesterSurvey({
      userId: request.user.id,
      campaignId: request.reviewCampaign.id,
    })
    return { data: { survey: survey ? toSurveyDto(survey) : null } }
  }
}

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CaslAbilityGuard)
@RequireContext("organization", "project", "agentSessionInCampaign", "reviewCampaignMembership")
@Controller()
export class TesterSessionFeedbackController {
  constructor(private readonly testerService: TesterService) {}

  @Post(ReviewCampaignsRoutes.submitTesterFeedback.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async submitTesterFeedback(
    @Req() request: EndpointRequestWithAgentSessionInCampaign &
      EndpointRequestWithReviewCampaignMembership,
    @Body() { payload }: typeof ReviewCampaignsRoutes.submitTesterFeedback.request,
  ): Promise<typeof ReviewCampaignsRoutes.submitTesterFeedback.response> {
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
    return { data: toFeedbackDto(feedback) }
  }

  @Patch(ReviewCampaignsRoutes.updateTesterFeedback.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async updateTesterFeedback(
    @Req() request: EndpointRequestWithAgentSessionInCampaign &
      EndpointRequestWithReviewCampaignMembership,
    @Body() { payload }: typeof ReviewCampaignsRoutes.updateTesterFeedback.request,
  ): Promise<typeof ReviewCampaignsRoutes.updateTesterFeedback.response> {
    const { sessionId, userId } = request.agentSessionInCampaign
    const feedback = await this.testerService.updateFeedback({
      sessionId,
      sessionOwnerUserId: userId,
      callerUserId: request.user.id,
      fields: payload,
    })
    return { data: toFeedbackDto(feedback) }
  }

  @Delete(ReviewCampaignsRoutes.deleteTesterSession.path)
  @CheckAbility(
    "read",
    "Tester",
    (req: EndpointRequestWithReviewCampaignMembership) => req.reviewCampaign,
  )
  async deleteTesterSession(
    @Req() request: EndpointRequestWithAgentSessionInCampaign &
      EndpointRequestWithReviewCampaignMembership,
  ): Promise<typeof ReviewCampaignsRoutes.deleteTesterSession.response> {
    const { sessionId, agentType, userId } = request.agentSessionInCampaign
    await this.testerService.deleteTesterSession({
      sessionId,
      agentType,
      sessionOwnerUserId: userId,
      callerUserId: request.user.id,
    })
    return { data: { success: true } }
  }
}

function toMyCampaignDto(
  campaign: ReviewCampaign,
): ListMyReviewCampaignsResponseDto["reviewCampaigns"][number] {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    agentId: campaign.agentId,
    createdAt: campaign.createdAt.getTime(),
    organizationId: campaign.organizationId,
    projectId: campaign.projectId,
  }
}

function toTesterContextDto(
  campaign: ReviewCampaign,
  agent: Agent,
): ReviewCampaignTesterContextDto {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    agent: {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      greetingMessage: agent.greetingMessage ?? undefined,
      outputJsonSchema: agent.outputJsonSchema ?? undefined,
    },
    testerPerSessionQuestions: campaign.testerPerSessionQuestions,
    testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
  }
}

function toMyTesterSessionSummaryDto(summary: MyTesterSessionSummary): MyTesterSessionSummaryDto {
  return {
    id: summary.id,
    agentType: summary.agentType,
    createdAt: summary.createdAt.getTime(),
    updatedAt: summary.updatedAt.getTime(),
    feedbackStatus: summary.feedbackStatus,
    result: summary.result ?? undefined,
    agentId: summary.agentId,
    type: summary.type,
  }
}

function toFeedbackDto(feedback: TesterSessionFeedback): TesterSessionFeedbackDto {
  return {
    id: feedback.id,
    campaignId: feedback.campaignId,
    sessionId: feedback.sessionId,
    agentType: feedback.agentType,
    overallRating: feedback.overallRating,
    comment: feedback.comment,
    answers: feedback.answers,
    createdAt: feedback.createdAt.getTime(),
    updatedAt: feedback.updatedAt.getTime(),
  }
}

function toSurveyDto(survey: TesterCampaignSurvey): TesterCampaignSurveyDto {
  return {
    id: survey.id,
    campaignId: survey.campaignId,
    userId: survey.userId,
    overallRating: survey.overallRating,
    comment: survey.comment,
    answers: survey.answers,
    submittedAt: survey.submittedAt.getTime(),
    createdAt: survey.createdAt.getTime(),
    updatedAt: survey.updatedAt.getTime(),
  }
}

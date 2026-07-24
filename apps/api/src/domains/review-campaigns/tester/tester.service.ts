import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import type { BaseAgentSessionType } from "@/domains/agents/base-agent-sessions/base-agent-sessions.types"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipsService } from "../memberships/review-campaign-memberships.service"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignAgentType, ReviewCampaignAnswer } from "../review-campaigns.types"
import { TesterCampaignSurvey } from "../tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "../tester-session-feedbacks/tester-session-feedback.entity"

export type MyTesterSessionSummary = {
  agentType: ReviewCampaignAgentType
  feedbackStatus: "submitted" | "pending" | "abandoned"
} & {} & Pick<
    ConversationAgentSession,
    "id" | "result" | "createdAt" | "updatedAt" | "agentId" | "type"
  >

export type CampaignAggregates = {
  meanTesterRating: number | null
  surveyCount: number
  sessionCount: number
}

export type TesterFeedbackFields = {
  overallRating: number
  comment?: string | null
  answers?: ReviewCampaignAnswer[]
}

export type TesterSurveyFields = TesterFeedbackFields

@Injectable()
export class TesterService {
  constructor(
    private readonly reviewCampaignMembershipsService: ReviewCampaignMembershipsService,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(ConversationAgentSession)
    private readonly conversationSessionRepository: Repository<ConversationAgentSession>,
    @InjectRepository(TesterSessionFeedback)
    private readonly feedbackRepository: Repository<TesterSessionFeedback>,
    @InjectRepository(TesterCampaignSurvey)
    private readonly surveyRepository: Repository<TesterCampaignSurvey>,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  async listMyCampaigns(
    userId: string,
    role: "tester" | "reviewer" = "tester",
  ): Promise<ReviewCampaign[]> {
    return this.reviewCampaignMembershipsService.listCampaignsForUser(userId, role)
  }

  async getAgentForCampaign({
    connectScope,
    campaign,
  }: {
    connectScope: RequiredConnectScope
    campaign: ReviewCampaign
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const agent = await this.agentRepository.findOne({
      where: {
        id: campaign.agentId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
      },
    })
    if (!agent) throw new NotFoundException(`Agent ${campaign.agentId} not found`)

    const agentSettings = await this.agentSettingsService.getLast({
      connectScope,
      agentId: agent.id,
    })
    if (!agentSettings)
      throw new NotFoundException(`AgentSettings for Agent ${campaign.agentId} not found`)

    return { agent, agentSettings }
  }

  async listMyTesterSessions({
    userId,
    campaignId,
  }: {
    userId: string
    campaignId: string
  }): Promise<MyTesterSessionSummary[]> {
    const conversationSessions = await this.conversationSessionRepository.find({
      where: { userId, campaignId },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        agentId: true,
        type: true,
        result: true,
      },
    })

    const sessionIds = conversationSessions.map((session) => session.id)
    const feedbacks =
      sessionIds.length > 0
        ? await this.feedbackRepository
            .createQueryBuilder("feedback")
            .select("feedback.session_id", "sessionId")
            .where("feedback.session_id IN (:...sessionIds)", { sessionIds })
            .getRawMany<{ sessionId: string }>()
        : []
    const feedbackBySessionId = new Set(feedbacks.map((feedback) => feedback.sessionId))

    const summaries: MyTesterSessionSummary[] = conversationSessions.map((session) => ({
      id: session.id,
      agentType: "conversation" as const,
      feedbackStatus: feedbackBySessionId.has(session.id)
        ? ("submitted" as const)
        : ("pending" as const),
      result: session.result,
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
      agentId: session.agentId,
      type: session.type,
    }))
    return summaries.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  }

  async startSession({
    connectScope,
    campaign,
    userId,
    type,
  }: {
    connectScope: RequiredConnectScope
    campaign: ReviewCampaign
    userId: string
    type: BaseAgentSessionType
  }): Promise<{ id: string; agentType: ReviewCampaignAgentType }> {
    const { agent, agentSettings } = await this.getAgentForCampaign({ connectScope, campaign })

    if (agent.type !== "conversation") {
      throw new UnprocessableEntityException(`Unsupported agent type: ${agent.type}`)
    }

    const session = await this.conversationAgentSessionsService.createSession({
      connectScope,
      agentSettingsId: agentSettings.id,
      userId,
      type,
    })
    session.campaignId = campaign.id
    await this.conversationSessionRepository.save(session)
    return { id: session.id, agentType: "conversation" }
  }

  async submitFeedback({
    connectScope,
    sessionId,
    agentType,
    sessionOwnerUserId,
    campaign,
    callerUserId,
    fields,
  }: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentType: ReviewCampaignAgentType
    sessionOwnerUserId: string
    campaign: ReviewCampaign
    callerUserId: string
    fields: TesterFeedbackFields
  }): Promise<TesterSessionFeedback> {
    this.validateRating(fields.overallRating)
    this.assertSessionOwnedByCaller(sessionOwnerUserId, callerUserId)

    const existing = await this.feedbackRepository.findOne({ where: { sessionId } })
    if (existing) {
      throw new ConflictException(
        `Feedback already submitted for session ${sessionId}; use PATCH to update`,
      )
    }

    const feedback = this.feedbackRepository.create({
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      campaignId: campaign.id,
      sessionId,
      agentType,
      overallRating: fields.overallRating,
      comment: fields.comment ?? null,
      answers: fields.answers ?? [],
    })
    return this.feedbackRepository.save(feedback)
  }

  async updateFeedback({
    sessionId,
    sessionOwnerUserId,
    callerUserId,
    fields,
  }: {
    sessionId: string
    sessionOwnerUserId: string
    callerUserId: string
    fields: Partial<TesterFeedbackFields>
  }): Promise<TesterSessionFeedback> {
    if (fields.overallRating !== undefined) this.validateRating(fields.overallRating)
    this.assertSessionOwnedByCaller(sessionOwnerUserId, callerUserId)

    const feedback = await this.feedbackRepository.findOne({ where: { sessionId } })
    if (!feedback) {
      throw new NotFoundException(`No feedback found for session ${sessionId}`)
    }

    if (fields.overallRating !== undefined) feedback.overallRating = fields.overallRating
    if (fields.comment !== undefined) feedback.comment = fields.comment
    if (fields.answers !== undefined) feedback.answers = fields.answers
    return this.feedbackRepository.save(feedback)
  }

  async computeCampaignAggregates(campaignId: string): Promise<CampaignAggregates> {
    const [ratingRow, surveyCount, sessionCount] = await Promise.all([
      this.feedbackRepository
        .createQueryBuilder("feedback")
        .select("AVG(feedback.overall_rating)", "mean")
        .where("feedback.campaign_id = :campaignId", { campaignId })
        .getRawOne<{ mean: string | null }>(),
      this.surveyRepository.count({ where: { campaignId } }),
      this.conversationSessionRepository.count({ where: { campaignId } }),
    ])
    const mean = ratingRow?.mean
    return {
      meanTesterRating: mean === null || mean === undefined ? null : Number(mean),
      surveyCount,
      sessionCount,
    }
  }

  async getMyTesterSurvey({
    userId,
    campaignId,
  }: {
    userId: string
    campaignId: string
  }): Promise<TesterCampaignSurvey | null> {
    return this.surveyRepository.findOne({ where: { campaignId, userId } })
  }

  async deleteTesterSession({
    sessionId,
    agentType,
    sessionOwnerUserId,
    callerUserId,
  }: {
    sessionId: string
    agentType: ReviewCampaignAgentType
    sessionOwnerUserId: string
    callerUserId: string
  }): Promise<void> {
    this.assertSessionOwnedByCaller(sessionOwnerUserId, callerUserId)

    const feedback = await this.feedbackRepository.findOne({ where: { sessionId } })
    if (feedback) {
      throw new ConflictException(
        "Cannot delete a session that has feedback; remove the feedback first",
      )
    }

    if (agentType !== "conversation") {
      throw new UnprocessableEntityException(`Unsupported agent type: ${agentType}`)
    }
    await this.conversationSessionRepository.delete({ id: sessionId })
  }

  async submitSurvey({
    connectScope,
    campaign,
    userId,
    fields,
  }: {
    connectScope: RequiredConnectScope
    campaign: ReviewCampaign
    userId: string
    fields: TesterSurveyFields
  }): Promise<TesterCampaignSurvey> {
    this.validateRating(fields.overallRating)

    const existing = await this.surveyRepository.findOne({
      where: { campaignId: campaign.id, userId },
    })
    if (existing) {
      throw new ConflictException(
        "End-of-phase survey already submitted for this campaign; use PATCH to update",
      )
    }

    const survey = this.surveyRepository.create({
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      campaignId: campaign.id,
      userId,
      overallRating: fields.overallRating,
      comment: fields.comment ?? null,
      answers: fields.answers ?? [],
      submittedAt: new Date(),
    })
    return this.surveyRepository.save(survey)
  }

  async updateSurvey({
    campaign,
    userId,
    fields,
  }: {
    campaign: ReviewCampaign
    userId: string
    fields: Partial<TesterSurveyFields>
  }): Promise<TesterCampaignSurvey> {
    if (fields.overallRating !== undefined) this.validateRating(fields.overallRating)

    const survey = await this.surveyRepository.findOne({
      where: { campaignId: campaign.id, userId },
    })
    if (!survey) {
      throw new NotFoundException("No end-of-phase survey submitted yet for this campaign")
    }

    if (fields.overallRating !== undefined) survey.overallRating = fields.overallRating
    if (fields.comment !== undefined) survey.comment = fields.comment
    if (fields.answers !== undefined) survey.answers = fields.answers
    return this.surveyRepository.save(survey)
  }

  private assertSessionOwnedByCaller(sessionOwnerUserId: string, callerUserId: string): void {
    if (sessionOwnerUserId !== callerUserId) {
      throw new NotFoundException("Agent session not found")
    }
  }

  private validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new UnprocessableEntityException("Overall rating must be an integer between 1 and 5")
    }
  }
}

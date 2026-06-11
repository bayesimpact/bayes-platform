import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type {
  ReviewCampaignAgentType,
  ReviewCampaignAnswer,
  ReviewCampaignQuestion,
} from "../review-campaigns.types"
import { ReviewerSessionReview } from "../reviewer-session-reviews/reviewer-session-review.entity"
import { TesterSessionFeedback } from "../tester-session-feedbacks/tester-session-feedback.entity"

export type SubmitReviewerReviewFields = {
  overallRating: number
  comment?: string | null
  answers?: ReviewCampaignAnswer[]
}

export type UpdateReviewerReviewFields = Partial<SubmitReviewerReviewFields>

export type ReviewerSessionSummary = {
  sessionId: string
  agentType: ReviewCampaignAgentType
  testerUserId: string
  startedAt: Date
  messageCount: number
  reviewerCount: number
  callerHasReviewed: boolean
  callerIsSessionOwner: boolean
}

export type ReviewerFormResult = {
  schema: Record<string, unknown>
  value: Record<string, unknown> | null
}

type ReviewerSessionMetaResult = {
  sessionId: string
  agentType: ReviewCampaignAgentType
  testerUserId: string
  startedAt: Date
  agent: Pick<Agent, "id" | "name" | "type">
  transcript: AgentMessage[]
  reviewerQuestions: ReviewCampaignQuestion[]
  otherReviewerCount: number
  formResult: ReviewerFormResult | null
}

export type ReviewerSessionViewResult =
  | (ReviewerSessionMetaResult & {
      blind: true
      factualTesterQuestions: ReviewCampaignQuestion[]
      factualTesterAnswers: ReviewCampaignAnswer[]
    })
  | (ReviewerSessionMetaResult & {
      blind: false
      testerPerSessionQuestions: ReviewCampaignQuestion[]
      testerFeedback: TesterSessionFeedback | null
      myReview: ReviewerSessionReview
      otherReviews: ReviewerSessionReview[]
    })

@Injectable()
export class ReviewerService {
  constructor(
    @InjectRepository(ReviewerSessionReview)
    private readonly reviewRepository: Repository<ReviewerSessionReview>,
    @InjectRepository(ConversationAgentSession)
    private readonly conversationSessionRepository: Repository<ConversationAgentSession>,
    @InjectRepository(FormAgentSession)
    private readonly formSessionRepository: Repository<FormAgentSession>,
    @InjectRepository(AgentMessage)
    private readonly agentMessageRepository: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(TesterSessionFeedback)
    private readonly testerFeedbackRepository: Repository<TesterSessionFeedback>,
  ) {}

  async listSessionsForCampaign({
    campaignId,
    reviewerUserId,
  }: {
    campaignId: string
    reviewerUserId: string
  }): Promise<ReviewerSessionSummary[]> {
    const [conversationSessions, formSessions] = await Promise.all([
      this.conversationSessionRepository.find({
        where: { campaignId },
        select: { id: true, userId: true, createdAt: true },
      }),
      this.formSessionRepository.find({
        where: { campaignId },
        select: { id: true, userId: true, createdAt: true },
      }),
    ])

    type BaseSummary = Pick<
      ReviewerSessionSummary,
      "sessionId" | "agentType" | "testerUserId" | "startedAt"
    >
    const sessions: BaseSummary[] = [
      ...conversationSessions.map((session) => ({
        sessionId: session.id,
        agentType: "conversation" as const,
        testerUserId: session.userId,
        startedAt: session.createdAt,
      })),
      ...formSessions.map((session) => ({
        sessionId: session.id,
        agentType: "form" as const,
        testerUserId: session.userId,
        startedAt: session.createdAt,
      })),
    ]
    if (sessions.length === 0) return []

    const sessionIds = sessions.map((session) => session.sessionId)

    const [messageCounts, reviewerCounts, callerReviews] = await Promise.all([
      this.agentMessageRepository
        .createQueryBuilder("message")
        .select("message.session_id", "sessionId")
        .addSelect("COUNT(*)::int", "count")
        .where("message.session_id IN (:...sessionIds)", { sessionIds })
        .groupBy("message.session_id")
        .getRawMany<{ sessionId: string; count: number }>(),
      this.reviewRepository
        .createQueryBuilder("review")
        .select("review.session_id", "sessionId")
        .addSelect("COUNT(*)::int", "count")
        .where("review.session_id IN (:...sessionIds)", { sessionIds })
        .groupBy("review.session_id")
        .getRawMany<{ sessionId: string; count: number }>(),
      this.reviewRepository.find({
        where: { reviewerUserId },
        select: { sessionId: true },
      }),
    ])

    const messageCountBy = new Map(messageCounts.map((row) => [row.sessionId, row.count] as const))
    const reviewerCountBy = new Map(
      reviewerCounts.map((row) => [row.sessionId, row.count] as const),
    )
    const callerReviewedSessionIds = new Set(callerReviews.map((review) => review.sessionId))

    return sessions
      .map((session) => ({
        ...session,
        messageCount: messageCountBy.get(session.sessionId) ?? 0,
        reviewerCount: reviewerCountBy.get(session.sessionId) ?? 0,
        callerHasReviewed: callerReviewedSessionIds.has(session.sessionId),
        callerIsSessionOwner: session.testerUserId === reviewerUserId,
      }))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
  }

  async getSessionForReview({
    campaign,
    sessionId,
    agentType,
    sessionOwnerUserId,
    reviewerUserId,
  }: {
    campaign: ReviewCampaign
    sessionId: string
    agentType: ReviewCampaignAgentType
    sessionOwnerUserId: string
    reviewerUserId: string
  }): Promise<ReviewerSessionViewResult> {
    // Loads everything we need in parallel. Redaction happens below based on
    // whether the caller has already reviewed.
    const [
      agent,
      transcript,
      callerReview,
      allReviews,
      testerFeedback,
      sessionStartedAt,
      formSession,
    ] = await Promise.all([
      this.agentRepository.findOne({
        where: {
          id: campaign.agentId,
          organizationId: campaign.organizationId,
          projectId: campaign.projectId,
        },
      }),
      this.agentMessageRepository.find({
        where: { sessionId, role: In(["user", "assistant"]) },
        order: { createdAt: "ASC" },
      }),
      this.reviewRepository.findOne({ where: { sessionId, reviewerUserId } }),
      this.reviewRepository.find({ where: { sessionId } }),
      this.testerFeedbackRepository.findOne({ where: { sessionId } }),
      this.resolveSessionStartedAt(sessionId, agentType),
      agentType === "form"
        ? this.formSessionRepository.findOne({
            where: { id: sessionId },
            select: { id: true, result: true },
          })
        : Promise.resolve(null),
    ])

    if (!agent) {
      throw new Error(`Agent ${campaign.agentId} not found for campaign ${campaign.id}`)
    }

    const otherReviews = allReviews.filter((review) => review.reviewerUserId !== reviewerUserId)
    const formResult: ReviewerFormResult | null =
      agentType === "form"
        ? {
            schema: agent.outputJsonSchema ?? {},
            value: formSession?.result ?? null,
          }
        : null
    const meta: ReviewerSessionMetaResult = {
      sessionId,
      agentType,
      testerUserId: sessionOwnerUserId,
      startedAt: sessionStartedAt,
      agent: { id: agent.id, name: agent.name, type: agent.type },
      transcript,
      reviewerQuestions: campaign.reviewerQuestions,
      otherReviewerCount: otherReviews.length,
      formResult,
    }

    if (callerReview) {
      return {
        ...meta,
        blind: false,
        testerPerSessionQuestions: campaign.testerPerSessionQuestions,
        testerFeedback,
        myReview: callerReview,
        otherReviews,
      }
    }

    return {
      ...meta,
      blind: true,
      factualTesterQuestions: filterFactualQuestions(campaign.testerPerSessionQuestions),
      factualTesterAnswers: filterFactualAnswers(
        campaign.testerPerSessionQuestions,
        testerFeedback?.answers ?? [],
      ),
    }
  }

  private async resolveSessionStartedAt(
    sessionId: string,
    agentType: ReviewCampaignAgentType,
  ): Promise<Date> {
    switch (agentType) {
      case "conversation": {
        const session = await this.conversationSessionRepository.findOne({
          where: { id: sessionId },
          select: { id: true, createdAt: true },
        })
        if (!session) throw new Error(`Conversation session ${sessionId} not found`)
        return session.createdAt
      }
      case "form": {
        const session = await this.formSessionRepository.findOne({
          where: { id: sessionId },
          select: { id: true, createdAt: true },
        })
        if (!session) throw new Error(`Form session ${sessionId} not found`)
        return session.createdAt
      }
      default:
        // extraction is not supported as a review target today; caller shouldn't
        // hit this branch because tester sessions start as conversation or form.
        throw new Error(`Unsupported session type: ${agentType}`)
    }
  }

  async submitReview({
    connectScope,
    campaign,
    sessionId,
    agentType,
    sessionOwnerUserId,
    reviewerUserId,
    fields,
  }: {
    connectScope: RequiredConnectScope
    campaign: ReviewCampaign
    sessionId: string
    agentType: ReviewCampaignAgentType
    sessionOwnerUserId: string
    reviewerUserId: string
    fields: SubmitReviewerReviewFields
  }): Promise<ReviewerSessionReview> {
    this.validateRating(fields.overallRating)
    this.assertNotReviewingOwnSession(sessionOwnerUserId, reviewerUserId)

    const existing = await this.reviewRepository.findOne({
      where: { sessionId, reviewerUserId },
    })
    if (existing) {
      throw new ConflictException(
        `Review already submitted for session ${sessionId}; use PATCH to update`,
      )
    }

    const now = new Date()
    const review = this.reviewRepository.create({
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      campaignId: campaign.id,
      sessionId,
      agentType,
      reviewerUserId,
      overallRating: fields.overallRating,
      comment: fields.comment ?? null,
      answers: fields.answers ?? [],
      submittedAt: now,
    })
    return this.reviewRepository.save(review)
  }

  async updateReview({
    reviewId,
    sessionId,
    sessionOwnerUserId,
    reviewerUserId,
    fields,
  }: {
    reviewId: string
    sessionId: string
    sessionOwnerUserId: string
    reviewerUserId: string
    fields: UpdateReviewerReviewFields
  }): Promise<ReviewerSessionReview> {
    if (fields.overallRating !== undefined) this.validateRating(fields.overallRating)
    this.assertNotReviewingOwnSession(sessionOwnerUserId, reviewerUserId)

    const review = await this.reviewRepository.findOne({ where: { id: reviewId } })
    if (!review || review.sessionId !== sessionId) {
      throw new NotFoundException(`Review ${reviewId} not found`)
    }
    if (review.reviewerUserId !== reviewerUserId) {
      throw new ForbiddenException("Cannot update another reviewer's review")
    }

    if (fields.overallRating !== undefined) review.overallRating = fields.overallRating
    if (fields.comment !== undefined) review.comment = fields.comment
    if (fields.answers !== undefined) review.answers = fields.answers
    return this.reviewRepository.save(review)
  }

  private assertNotReviewingOwnSession(sessionOwnerUserId: string, reviewerUserId: string): void {
    if (sessionOwnerUserId === reviewerUserId) {
      throw new ForbiddenException("Reviewers cannot review their own tester sessions")
    }
  }

  private validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new UnprocessableEntityException("Overall rating must be an integer between 1 and 5")
    }
  }
}

/**
 * Implements the blind-review redaction rule (spec §5).
 *
 * Only factual tester answers stay visible during blind review — those whose
 * question is of type `rating` or `single-choice` AND flagged `isFactual` in
 * the campaign config. Free-text answers are always considered opinion and
 * never show during blind.
 */
export function filterFactualQuestions(
  questions: ReviewCampaignQuestion[],
): ReviewCampaignQuestion[] {
  return questions.filter(
    (question) =>
      question.isFactual === true &&
      (question.type === "rating" || question.type === "single-choice"),
  )
}

export function filterFactualAnswers(
  questions: ReviewCampaignQuestion[],
  answers: ReviewCampaignAnswer[],
): ReviewCampaignAnswer[] {
  const factualQuestionIds = new Set(filterFactualQuestions(questions).map((q) => q.id))
  return answers.filter((answer) => factualQuestionIds.has(answer.questionId))
}

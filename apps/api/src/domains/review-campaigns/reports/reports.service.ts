import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type {
  ReviewCampaignAgentType,
  ReviewCampaignAnswer,
  ReviewCampaignQuestion,
} from "../review-campaigns.types"
import { ReviewerSessionReview } from "../reviewer-session-reviews/reviewer-session-review.entity"
import { TesterCampaignSurvey } from "../tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "../tester-session-feedbacks/tester-session-feedback.entity"

export type CampaignReportHeadline = {
  sessionCount: number
  testerFeedbackCount: number
  reviewerReviewCount: number
  meanTesterRating: number | null
  meanReviewerRating: number | null
  meanEndOfPhaseRating: number | null
  participantCount: number
}

export type CampaignReportBucket = {
  label: string
  count: number
}

export type CampaignReportQuestionDistribution = {
  questionId: string
  prompt: string
  type: ReviewCampaignQuestion["type"]
  responseCount: number
  buckets: CampaignReportBucket[]
}

export type CampaignReportSessionRow = {
  sessionId: string
  agentType: ReviewCampaignAgentType
  testerUserId: string
  startedAt: Date
  testerRating: number | null
  reviewerRatings: number[]
  reviewerCount: number
  meanReviewerRating: number | null
  reviewerRatingSpread: number | null
}

export type CampaignReport = {
  campaignId: string
  headline: CampaignReportHeadline
  testerPerSessionDistributions: CampaignReportQuestionDistribution[]
  testerEndOfPhaseDistributions: CampaignReportQuestionDistribution[]
  reviewerDistributions: CampaignReportQuestionDistribution[]
  sessionMatrix: CampaignReportSessionRow[]
}

type SessionRef = {
  id: string
  userId: string
  createdAt: Date
  agentType: ReviewCampaignAgentType
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ConversationAgentSession)
    private readonly conversationSessionRepository: Repository<ConversationAgentSession>,
    @InjectRepository(FormAgentSession)
    private readonly formSessionRepository: Repository<FormAgentSession>,
    @InjectRepository(TesterSessionFeedback)
    private readonly testerFeedbackRepository: Repository<TesterSessionFeedback>,
    @InjectRepository(TesterCampaignSurvey)
    private readonly testerSurveyRepository: Repository<TesterCampaignSurvey>,
    @InjectRepository(ReviewerSessionReview)
    private readonly reviewRepository: Repository<ReviewerSessionReview>,
  ) {}

  async computeReport(campaign: ReviewCampaign): Promise<CampaignReport> {
    const campaignId = campaign.id

    const [conversationSessions, formSessions, feedbacks, surveys, reviews] = await Promise.all([
      this.conversationSessionRepository.find({
        where: { campaignId },
        select: { id: true, userId: true, createdAt: true },
      }),
      this.formSessionRepository.find({
        where: { campaignId },
        select: { id: true, userId: true, createdAt: true },
      }),
      this.testerFeedbackRepository.find({ where: { campaignId } }),
      this.testerSurveyRepository.find({ where: { campaignId } }),
      this.reviewRepository.find({ where: { campaignId } }),
    ])

    const sessions: SessionRef[] = [
      ...conversationSessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        agentType: "conversation" as const,
      })),
      ...formSessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        agentType: "form" as const,
      })),
    ]

    const feedbackBySessionId = new Map(feedbacks.map((feedback) => [feedback.sessionId, feedback]))
    const reviewsBySessionId = groupBy(reviews, (review) => review.sessionId)

    const headline: CampaignReportHeadline = {
      sessionCount: sessions.length,
      testerFeedbackCount: feedbacks.length,
      reviewerReviewCount: reviews.length,
      meanTesterRating: mean(feedbacks.map((feedback) => feedback.overallRating)),
      meanReviewerRating: mean(reviews.map((review) => review.overallRating)),
      meanEndOfPhaseRating: mean(surveys.map((survey) => survey.overallRating)),
      participantCount: new Set(sessions.map((session) => session.userId)).size,
    }

    const sessionMatrix = sessions
      .map((session) => buildSessionRow(session, feedbackBySessionId, reviewsBySessionId))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())

    return {
      campaignId,
      headline,
      testerPerSessionDistributions: buildDistributions(
        campaign.testerPerSessionQuestions,
        feedbacks.map((feedback) => feedback.answers),
      ),
      testerEndOfPhaseDistributions: buildDistributions(
        campaign.testerEndOfPhaseQuestions,
        surveys.map((survey) => survey.answers),
      ),
      reviewerDistributions: buildDistributions(
        campaign.reviewerQuestions,
        reviews.map((review) => review.answers),
      ),
      sessionMatrix,
    }
  }
}

function buildSessionRow(
  session: SessionRef,
  feedbackBySessionId: Map<string, TesterSessionFeedback>,
  reviewsBySessionId: Map<string, ReviewerSessionReview[]>,
): CampaignReportSessionRow {
  const reviewerRatings = (reviewsBySessionId.get(session.id) ?? []).map(
    (review) => review.overallRating,
  )
  return {
    sessionId: session.id,
    agentType: session.agentType,
    testerUserId: session.userId,
    startedAt: session.createdAt,
    testerRating: feedbackBySessionId.get(session.id)?.overallRating ?? null,
    reviewerRatings,
    reviewerCount: reviewerRatings.length,
    meanReviewerRating: mean(reviewerRatings),
    reviewerRatingSpread:
      reviewerRatings.length >= 2
        ? Math.max(...reviewerRatings) - Math.min(...reviewerRatings)
        : null,
  }
}

/**
 * Computes the per-question distribution across a set of answer arrays.
 *
 * Rating / single-choice questions report a bucket per configured option (or
 * per rating 1–5). Free-text questions report only responseCount (no buckets).
 * Missing answers are skipped — they don't pull the response count down and
 * don't show up as a bucket.
 */
export function buildDistributions(
  questions: ReviewCampaignQuestion[],
  answerSets: ReviewCampaignAnswer[][],
): CampaignReportQuestionDistribution[] {
  return questions.map((question) => {
    const matching = answerSets
      .map((answers) => answers.find((answer) => answer.questionId === question.id))
      .filter((answer): answer is ReviewCampaignAnswer => answer !== undefined)

    if (question.type === "free-text") {
      return {
        questionId: question.id,
        prompt: question.prompt,
        type: question.type,
        responseCount: matching.length,
        buckets: [],
      }
    }

    const counts = new Map<string, number>()
    for (const answer of matching) {
      for (const label of answerToLabels(answer.value)) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }

    const configuredLabels = bucketLabelsForQuestion(question)
    const seenLabels = Array.from(counts.keys()).filter(
      (label) => !configuredLabels.includes(label),
    )
    const labels = [...configuredLabels, ...seenLabels]

    return {
      questionId: question.id,
      prompt: question.prompt,
      type: question.type,
      responseCount: matching.length,
      buckets: labels.map((label) => ({ label, count: counts.get(label) ?? 0 })),
    }
  })
}

function bucketLabelsForQuestion(question: ReviewCampaignQuestion): string[] {
  if (question.type === "rating") return ["1", "2", "3", "4", "5"]
  if (question.type === "single-choice") return question.options ?? []
  return []
}

function answerToLabels(value: ReviewCampaignAnswer["value"]): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry))
  return [String(value)]
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((accumulator, value) => accumulator + value, 0)
  return sum / values.length
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      grouped.set(key, [item])
    }
  }
  return grouped
}

// Exported for convenience in tests/DTO mappers — sessionType is kept as the
// narrower "conversation" | "form" here because the report only ever sees
// sessions that testers actually ran (extraction isn't a tester session type).

export type ReviewCampaignReportableSessionType = ReviewCampaignAgentType

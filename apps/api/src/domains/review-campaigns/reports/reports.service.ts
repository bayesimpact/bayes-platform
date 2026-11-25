import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
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
  /** The answers to a free-text question, empty for the other types and when withheld. */
  textAnswers: string[]
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
  /** The tester's answer to each question of the session feedback, by question id. */
  testerAnswers: Record<string, string>
  /**
   * The reviewers' answers to each review question, by question id: one per review, in the
   * order of `reviewerRatings`, empty when that review left the question blank.
   */
  reviewerAnswers: Record<string, string[]>
  /** The tester's answer to each question of their final survey, by question id. */
  endOfPhaseAnswers: Record<string, string>
}

export type CampaignReport = {
  campaignId: string
  /**
   * Whether the report holds the answers: the free-text answers of each question and each
   * session's answers. Only who manages the campaign's project reads them. A reviewer reviews each
   * session blind, so the report withholds them and its answer fields stay empty.
   */
  showsAnswers: boolean
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
    @InjectRepository(TesterSessionFeedback)
    private readonly testerFeedbackRepository: Repository<TesterSessionFeedback>,
    @InjectRepository(TesterCampaignSurvey)
    private readonly testerSurveyRepository: Repository<TesterCampaignSurvey>,
    @InjectRepository(ReviewerSessionReview)
    private readonly reviewRepository: Repository<ReviewerSessionReview>,
    private readonly permissionService: PermissionService,
  ) {}

  /** The report of a campaign as this person may read it: with its answers for its managers only. */
  async computeReport(campaign: ReviewCampaign, userId: string): Promise<CampaignReport> {
    const campaignId = campaign.id
    const showsAnswers = await this.permissionService.has(
      userId,
      PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
      { type: "project", id: campaign.projectId },
    )

    const [conversationSessions, feedbacks, surveys, reviews] = await Promise.all([
      this.conversationSessionRepository.find({
        where: { campaignId },
        select: { id: true, userId: true, createdAt: true },
      }),
      this.testerFeedbackRepository.find({ where: { campaignId } }),
      this.testerSurveyRepository.find({ where: { campaignId } }),
      this.reviewRepository.find({ where: { campaignId } }),
    ])

    const sessions: SessionRef[] = conversationSessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      agentType: "conversation" as const,
    }))

    const feedbackBySessionId = new Map(feedbacks.map((feedback) => [feedback.sessionId, feedback]))
    const surveyByUserId = new Map(surveys.map((survey) => [survey.userId, survey]))
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
      .map((session) =>
        buildSessionRow(session, feedbackBySessionId, reviewsBySessionId, surveyByUserId),
      )
      .map((row) => (showsAnswers ? row : withoutAnswers(row)))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
    const distributionsOf = (
      questions: ReviewCampaignQuestion[],
      answerSets: ReviewCampaignAnswer[][],
    ) => {
      const distributions = buildDistributions(questions, answerSets)
      return showsAnswers
        ? distributions
        : distributions.map((distribution) => ({ ...distribution, textAnswers: [] }))
    }

    return {
      campaignId,
      showsAnswers,
      headline,
      testerPerSessionDistributions: distributionsOf(
        campaign.testerPerSessionQuestions,
        feedbacks.map((feedback) => feedback.answers),
      ),
      testerEndOfPhaseDistributions: distributionsOf(
        campaign.testerEndOfPhaseQuestions,
        surveys.map((survey) => survey.answers),
      ),
      reviewerDistributions: distributionsOf(
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
  surveyByUserId: Map<string, TesterCampaignSurvey>,
): CampaignReportSessionRow {
  const reviews = reviewsBySessionId.get(session.id) ?? []
  const reviewerRatings = reviews.map((review) => review.overallRating)
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
    testerAnswers: answerTextsOf(feedbackBySessionId.get(session.id)?.answers ?? []),
    reviewerAnswers: reviewerAnswersOf(reviews),
    endOfPhaseAnswers: answerTextsOf(surveyByUserId.get(session.userId)?.answers ?? []),
  }
}

/** A session row with no answer, for who may not read them. */
function withoutAnswers(row: CampaignReportSessionRow): CampaignReportSessionRow {
  return { ...row, testerAnswers: {}, reviewerAnswers: {}, endOfPhaseAnswers: {} }
}

/** Each answer as text, by question id. */
function answerTextsOf(answers: ReviewCampaignAnswer[]): Record<string, string> {
  return Object.fromEntries(
    answers.map((answer) => [answer.questionId, answerToText(answer.value)]),
  )
}

/**
 * The answers of a session's reviews, by question id: one per review in the reviews' order, so
 * they line up with the reviewer ratings, empty when a review left the question blank.
 */
function reviewerAnswersOf(reviews: ReviewerSessionReview[]): Record<string, string[]> {
  const textsByReview = reviews.map((review) => answerTextsOf(review.answers))
  const questionIds = new Set(textsByReview.flatMap((texts) => Object.keys(texts)))
  return Object.fromEntries(
    Array.from(questionIds, (questionId) => [
      questionId,
      textsByReview.map((texts) =>
        Object.hasOwn(texts, questionId) ? (texts[questionId] ?? "") : "",
      ),
    ]),
  )
}

/**
 * Computes the per-question distribution across a set of answer arrays.
 *
 * Rating / single-choice questions report a bucket per configured option (or
 * per rating 1–5). Free-text questions report their answers instead of buckets.
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
        textAnswers: matching.map((answer) => answerToText(answer.value)),
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
      textAnswers: [],
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

function answerToText(value: ReviewCampaignAnswer["value"]): string {
  return answerToLabels(value).join(", ")
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

// Exported for convenience in tests/DTO mappers — sessionType mirrors
// ReviewCampaignAgentType because the report only ever sees sessions that
// testers actually ran (extraction isn't a tester session type).

export type ReviewCampaignReportableSessionType = ReviewCampaignAgentType

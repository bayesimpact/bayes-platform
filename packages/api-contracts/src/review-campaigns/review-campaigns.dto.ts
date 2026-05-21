import type { TimeType } from "../generic"

export type ReviewCampaignStatus = "draft" | "active" | "closed"

export type ReviewCampaignMembershipRole = "tester" | "reviewer"

export type ReviewCampaignQuestionType = "rating" | "single-choice" | "free-text"

export type ReviewCampaignQuestionDto = {
  id: string
  prompt: string
  type: ReviewCampaignQuestionType
  required: boolean
  options?: string[]
  /**
   * Tester per-session questions only. When true and the question type is
   * `rating` or `single-choice`, the tester's answer stays visible to reviewers
   * during blind review (factual: describes what happened). When false/absent,
   * the answer is hidden until the reviewer submits (opinion).
   */
  isFactual?: boolean
}

export type ReviewCampaignDto = {
  id: string
  organizationId: string
  projectId: string
  agentId: string
  name: string
  description: string | null
  status: ReviewCampaignStatus
  testerPerSessionQuestions: ReviewCampaignQuestionDto[]
  testerEndOfPhaseQuestions: ReviewCampaignQuestionDto[]
  reviewerQuestions: ReviewCampaignQuestionDto[]
  activatedAt: TimeType | null
  closedAt: TimeType | null
  createdAt: TimeType
  updatedAt: TimeType
}

export type ReviewCampaignMembershipDto = {
  id: string
  campaignId: string
  userId: string
  userEmail: string
  role: ReviewCampaignMembershipRole
  acceptedAt: TimeType | null
}

export type CampaignAggregatesDto = {
  meanTesterRating: number | null
  surveyCount: number
  sessionCount: number
}

export type ReviewCampaignDetailDto = ReviewCampaignDto & {
  memberships: ReviewCampaignMembershipDto[]
  aggregates: CampaignAggregatesDto | null
}

export type CreateReviewCampaignRequestDto = {
  agentId: string
  name: string
  description?: string | null
  testerPerSessionQuestions?: ReviewCampaignQuestionDto[]
  testerEndOfPhaseQuestions?: ReviewCampaignQuestionDto[]
  reviewerQuestions?: ReviewCampaignQuestionDto[]
}

export type UpdateReviewCampaignRequestDto = {
  name?: string
  description?: string | null
  testerPerSessionQuestions?: ReviewCampaignQuestionDto[]
  testerEndOfPhaseQuestions?: ReviewCampaignQuestionDto[]
  reviewerQuestions?: ReviewCampaignQuestionDto[]
  status?: ReviewCampaignStatus
}

export type ReviewCampaignListItemDto = ReviewCampaignDto & {
  memberCount: number
}

export type ListReviewCampaignsResponseDto = {
  reviewCampaigns: ReviewCampaignListItemDto[]
}

// === Tester API ===

export type TesterAgentSnapshotDto = {
  id: string
  name: string
  type: "conversation" | "extraction" | "form"
  greetingMessage: string | null
}

export type ReviewCampaignTesterContextDto = {
  id: string
  name: string
  description: string | null
  status: ReviewCampaignStatus
  agent: TesterAgentSnapshotDto
  testerPerSessionQuestions: ReviewCampaignQuestionDto[]
  testerEndOfPhaseQuestions: ReviewCampaignQuestionDto[]
}

export type ListMyReviewCampaignsResponseDto = {
  reviewCampaigns: Array<
    Pick<ReviewCampaignDto, "id" | "name" | "description" | "status" | "agentId" | "createdAt"> & {
      organizationId: string
      projectId: string
    }
  >
}

export type ReviewCampaignTesterFeedbackAnswerDto = {
  questionId: string
  value: string | number | string[]
}

export type TesterSessionFeedbackDto = {
  id: string
  campaignId: string
  sessionId: string
  sessionType: "conversation" | "extraction" | "form"
  overallRating: number
  comment: string | null
  answers: ReviewCampaignTesterFeedbackAnswerDto[]
  createdAt: TimeType
  updatedAt: TimeType
}

export type SubmitTesterSessionFeedbackRequestDto = {
  overallRating: number
  comment?: string | null
  answers?: ReviewCampaignTesterFeedbackAnswerDto[]
}

export type UpdateTesterSessionFeedbackRequestDto = Partial<SubmitTesterSessionFeedbackRequestDto>

export type TesterCampaignSurveyDto = {
  id: string
  campaignId: string
  userId: string
  overallRating: number
  comment: string | null
  answers: ReviewCampaignTesterFeedbackAnswerDto[]
  submittedAt: TimeType
  createdAt: TimeType
  updatedAt: TimeType
}

export type SubmitTesterCampaignSurveyRequestDto = {
  overallRating: number
  comment?: string | null
  answers?: ReviewCampaignTesterFeedbackAnswerDto[]
}

export type UpdateTesterCampaignSurveyRequestDto = Partial<SubmitTesterCampaignSurveyRequestDto>

export type StartTesterSessionRequestDto = {
  type: "playground" | "live"
}

export type StartTesterSessionResponseDto = {
  sessionId: string
  sessionType: "conversation" | "form"
}

export type MyTesterSessionSummaryDto = {
  sessionId: string
  sessionType: "conversation" | "form"
  startedAt: TimeType
  feedbackStatus: "submitted" | "pending"
}

export type ListMyTesterSessionsResponseDto = {
  sessions: MyTesterSessionSummaryDto[]
}

export type GetMyTesterSurveyResponseDto = {
  survey: TesterCampaignSurveyDto | null
}

// === Reviewer API ===

export type ReviewerSessionReviewDto = {
  id: string
  campaignId: string
  sessionId: string
  sessionType: "conversation" | "extraction" | "form"
  reviewerUserId: string
  overallRating: number
  comment: string | null
  answers: ReviewCampaignTesterFeedbackAnswerDto[]
  submittedAt: TimeType
  createdAt: TimeType
  updatedAt: TimeType
}

export type SubmitReviewerSessionReviewRequestDto = {
  overallRating: number
  comment?: string | null
  answers?: ReviewCampaignTesterFeedbackAnswerDto[]
}

export type UpdateReviewerSessionReviewRequestDto = Partial<SubmitReviewerSessionReviewRequestDto>

export type ReviewerSessionListItemDto = {
  sessionId: string
  sessionType: "conversation" | "form"
  testerUserId: string
  startedAt: TimeType
  messageCount: number
  reviewerCount: number
  callerHasReviewed: boolean
  callerIsSessionOwner: boolean
}

export type ListReviewerSessionsResponseDto = {
  sessions: ReviewerSessionListItemDto[]
}

export type ReviewerSessionTranscriptMessageDto = {
  id: string
  role: string
  content: string
  createdAt: TimeType
}

export type ReviewerAgentSnapshotDto = {
  id: string
  name: string
  type: "conversation" | "extraction" | "form"
}

export type ReviewerFormResultDto = {
  /** The agent's outputJsonSchema (JSON Schema object) describing the form fields. */
  schema: Record<string, unknown>
  /** The collected values; null when the user abandoned the session before completion. */
  value: Record<string, unknown> | null
}

type ReviewerSessionMetaDto = {
  sessionId: string
  sessionType: "conversation" | "extraction" | "form"
  testerUserId: string
  startedAt: TimeType
  agent: ReviewerAgentSnapshotDto
  transcript: ReviewerSessionTranscriptMessageDto[]
  reviewerQuestions: ReviewCampaignQuestionDto[]
  otherReviewerCount: number
  /** Populated only for `sessionType === "form"` sessions. */
  formResult: ReviewerFormResultDto | null
}

export type ReviewerSessionBlindDto = ReviewerSessionMetaDto & {
  blind: true
  factualTesterQuestions: ReviewCampaignQuestionDto[]
  factualTesterAnswers: ReviewCampaignTesterFeedbackAnswerDto[]
}

export type ReviewerSessionFullDto = ReviewerSessionMetaDto & {
  blind: false
  testerPerSessionQuestions: ReviewCampaignQuestionDto[]
  testerFeedback: {
    overallRating: number
    comment: string | null
    answers: ReviewCampaignTesterFeedbackAnswerDto[]
  } | null
  myReview: ReviewerSessionReviewDto
  otherReviews: ReviewerSessionReviewDto[]
}

export type GetReviewerSessionResponseDto = ReviewerSessionBlindDto | ReviewerSessionFullDto

// === Aggregate report ===

export type CampaignReportHeadlineDto = {
  sessionCount: number
  testerFeedbackCount: number
  reviewerReviewCount: number
  meanTesterRating: number | null
  meanReviewerRating: number | null
  meanEndOfPhaseRating: number | null
  participantCount: number
}

export type CampaignReportBucketDto = {
  label: string
  count: number
}

export type CampaignReportQuestionDistributionDto = {
  questionId: string
  prompt: string
  type: ReviewCampaignQuestionType
  responseCount: number
  /** Empty for `free-text` questions (only responseCount is meaningful). */
  buckets: CampaignReportBucketDto[]
}

export type CampaignReportSessionRowDto = {
  sessionId: string
  sessionType: "conversation" | "form"
  testerUserId: string
  startedAt: TimeType
  testerRating: number | null
  reviewerRatings: number[]
  reviewerCount: number
  meanReviewerRating: number | null
  /** max(reviewerRatings) − min(reviewerRatings); null when < 2 reviewers. */
  reviewerRatingSpread: number | null
}

export type CampaignReportDto = {
  campaignId: string
  headline: CampaignReportHeadlineDto
  testerPerSessionDistributions: CampaignReportQuestionDistributionDto[]
  testerEndOfPhaseDistributions: CampaignReportQuestionDistributionDto[]
  reviewerDistributions: CampaignReportQuestionDistributionDto[]
  sessionMatrix: CampaignReportSessionRowDto[]
}

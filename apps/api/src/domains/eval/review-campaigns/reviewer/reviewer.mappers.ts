import type {
  ReviewCampaignAnswerDto,
  ReviewCampaignQuestionDto,
  ReviewerReviewOutputDto,
  ReviewerSessionListItemOutputDto,
  ReviewerSessionOutputDto,
} from "@bayes-platform/eval-contracts"
import type {
  ReviewerService,
  ReviewerSessionSummary,
  ReviewerSessionViewResult,
} from "@/domains/review-campaigns/reviewer/reviewer.service"

type ReviewerReview = Awaited<ReturnType<ReviewerService["submitReview"]>>

type ReviewCampaignQuestion = ReviewerSessionViewResult["reviewerQuestions"][number]

type TranscriptMessage = ReviewerSessionViewResult["transcript"][number]

function toQuestionDto(question: ReviewCampaignQuestion): ReviewCampaignQuestionDto {
  return {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    required: question.required,
    options: question.options,
    isFactual: question.isFactual,
  }
}

function toAnswerDto(answer: ReviewerReview["answers"][number]): ReviewCampaignAnswerDto {
  return { questionId: answer.questionId, value: answer.value }
}

/** A session in the reviewer's list, with the fields Evaluation reads. */
export function toReviewerSessionListItemDto(
  summary: ReviewerSessionSummary,
): ReviewerSessionListItemOutputDto {
  return {
    sessionId: summary.sessionId,
    startedAt: summary.startedAt.getTime(),
    messageCount: summary.messageCount,
    reviewerCount: summary.reviewerCount,
    callerHasReviewed: summary.callerHasReviewed,
    callerIsSessionOwner: summary.callerIsSessionOwner,
  }
}

/** A reviewer's review of a session, with the fields Evaluation reads. */
export function toReviewerReviewDto(review: ReviewerReview): ReviewerReviewOutputDto {
  return {
    id: review.id,
    reviewerUserId: review.reviewerUserId,
    overallRating: review.overallRating,
    comment: review.comment,
    answers: review.answers.map(toAnswerDto),
  }
}

/** The message the reviewer reads as the tester's chat received it, with the tools it called. */
function toTranscriptMessageDto(message: TranscriptMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.getTime(),
    toolCalls: message.toolCalls ?? [],
  }
}

/** A session as its reviewer sees it: blind before the review, full after it. */
export function toReviewerSessionDto(result: ReviewerSessionViewResult): ReviewerSessionOutputDto {
  const common = {
    sessionId: result.sessionId,
    testerUserId: result.testerUserId,
    startedAt: result.startedAt.getTime(),
    agent: result.agent,
    transcript: result.transcript.map(toTranscriptMessageDto),
    reviewerQuestions: result.reviewerQuestions.map(toQuestionDto),
    otherReviewerCount: result.otherReviewerCount,
    formResult: result.formResult,
  }

  if (result.blind) {
    return {
      ...common,
      blind: true,
      factualTesterQuestions: result.factualTesterQuestions.map(toQuestionDto),
      factualTesterAnswers: result.factualTesterAnswers.map(toAnswerDto),
    }
  }

  return {
    ...common,
    blind: false,
    testerPerSessionQuestions: result.testerPerSessionQuestions.map(toQuestionDto),
    testerFeedback: result.testerFeedback
      ? {
          overallRating: result.testerFeedback.overallRating,
          comment: result.testerFeedback.comment,
          answers: result.testerFeedback.answers.map(toAnswerDto),
        }
      : null,
    myReview: toReviewerReviewDto(result.myReview),
    otherReviews: result.otherReviews.map(toReviewerReviewDto),
  }
}

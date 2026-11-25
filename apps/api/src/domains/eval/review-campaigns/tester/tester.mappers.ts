import type {
  ConversationFormOutputDto,
  EvalTesterRoutes,
  ReviewCampaignAnswerDto,
  TesterSessionOutputDto,
  TesterSurveyOutputDto,
} from "@caseai-connect/eval-contracts"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
import type {
  MyTesterSessionSummary,
  TesterService,
} from "@/domains/review-campaigns/tester/tester.service"

type TesterFeedback = Awaited<ReturnType<TesterService["submitFeedback"]>>

type TesterSurvey = Awaited<ReturnType<TesterService["submitSurvey"]>>

type ConversationForm = MyTesterSessionSummary["forms"][number]

type TesterFeedbackOutputDto = SchemaRouteResponse<typeof EvalTesterRoutes.createFeedback>["data"]

function toAnswerDto(answer: TesterFeedback["answers"][number]): ReviewCampaignAnswerDto {
  return { questionId: answer.questionId, value: answer.value }
}

/**
 * A copy of `toConversationFormDto`, as `TesterController` calls it: with no form schema, so the
 * form carries none.
 */
function toConversationFormDto(form: ConversationForm): ConversationFormOutputDto {
  return {
    agentId: form.agentId,
    ...(form.agent?.name ? { agentName: form.agent.name } : {}),
    status: form.status,
    state: form.state,
    updatedAt: form.updatedAt.getTime(),
  }
}

/** A copy of `toMyTesterSessionSummaryDto` of `TesterController`, with the fields Evaluation reads. */
export function toTesterSessionDto(summary: MyTesterSessionSummary): TesterSessionOutputDto {
  return {
    id: summary.id,
    agentId: summary.agentId,
    feedbackStatus: summary.feedbackStatus,
    createdAt: summary.createdAt.getTime(),
    forms: summary.forms.map(toConversationFormDto),
  }
}

/** A copy of `toFeedbackDto` of `TesterSessionFeedbackController`, with the fields Evaluation reads. */
export function toTesterFeedbackDto(feedback: TesterFeedback): TesterFeedbackOutputDto {
  return {
    id: feedback.id,
    sessionId: feedback.sessionId,
    overallRating: feedback.overallRating,
    comment: feedback.comment,
    answers: feedback.answers.map(toAnswerDto),
  }
}

/** A copy of `toSurveyDto` of `TesterController`, with the fields Evaluation reads. */
export function toTesterSurveyDto(survey: TesterSurvey): TesterSurveyOutputDto {
  return {
    id: survey.id,
    overallRating: survey.overallRating,
    comment: survey.comment,
    answers: survey.answers.map(toAnswerDto),
  }
}

import {
  RATING_MAX,
  type RatedFeedbackInputDto,
  type ReviewCampaignAnswerDto,
  type ReviewCampaignQuestionDto,
} from "@bayes-platform/eval-contracts"
import { z } from "zod"

/** What a person fills to rate a session or a campaign: a rating, a comment and their answers. */
export type RatedFeedbackValues = {
  overallRating: number | null
  comment: string
  /** The answer to each question, by question id: `null` until the person answers. */
  answers: Record<string, string | number | null>
}

/** A rating, a comment and answers someone already gave. */
export type RatedFeedback = {
  overallRating: number
  comment: string | null
  answers: ReviewCampaignAnswerDto[]
}

const isAnswered = (value: string | number | null | undefined): value is string | number =>
  typeof value === "number" || (typeof value === "string" && value.trim() !== "")

/**
 * The schema of the form for these questions: a rating from 1 to 5 and an answer to every required
 * question. The API checks the rating only, so the form holds the rest.
 */
export function ratedFeedbackFormSchema(questions: ReviewCampaignQuestionDto[]) {
  return z
    .object({
      overallRating: z.number().int().min(1).max(RATING_MAX).nullable(),
      comment: z.string(),
      answers: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
    })
    .superRefine((values, context) => {
      if (values.overallRating === null) {
        context.addIssue({ code: "custom", path: ["overallRating"], message: "required" })
      }
      for (const question of questions) {
        if (question.required && !isAnswered(values.answers[question.id])) {
          context.addIssue({ code: "custom", path: ["answers", question.id], message: "required" })
        }
      }
    })
}

/** The form's values for these questions, from what the person gave before, or blank. */
export function ratedFeedbackValuesOf(
  questions: ReviewCampaignQuestionDto[],
  feedback: RatedFeedback | null,
): RatedFeedbackValues {
  const given = new Map(feedback?.answers.map((answer) => [answer.questionId, answer.value]))
  return {
    overallRating: feedback?.overallRating ?? null,
    comment: feedback?.comment ?? "",
    answers: Object.fromEntries(
      questions.map((question) => {
        const value = given.get(question.id)
        return [question.id, typeof value === "string" || typeof value === "number" ? value : null]
      }),
    ),
  }
}

/**
 * What the API takes from the form: the rating, the comment or `null` when blank, and the answers
 * the person gave, in the questions' order. `null` when the rating is missing, which the form's
 * schema refuses before.
 */
export function ratedFeedbackInputOf(
  questions: ReviewCampaignQuestionDto[],
  values: RatedFeedbackValues,
): RatedFeedbackInputDto | null {
  if (values.overallRating === null) return null
  return {
    overallRating: values.overallRating,
    comment: values.comment.trim() === "" ? null : values.comment,
    answers: questions.flatMap((question) => {
      const value = values.answers[question.id]
      return isAnswered(value) ? [{ questionId: question.id, value }] : []
    }),
  }
}

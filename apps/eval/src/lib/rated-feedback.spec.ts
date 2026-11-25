import type { ReviewCampaignQuestionDto } from "@bayes-platform/eval-contracts"
import { describe, expect, it } from "vitest"
import {
  ratedFeedbackFormSchema,
  ratedFeedbackInputOf,
  ratedFeedbackValuesOf,
} from "./rated-feedback"

const clarity: ReviewCampaignQuestionDto = {
  id: "clarity",
  prompt: "Was the answer clear?",
  type: "rating",
  required: true,
}
const notes: ReviewCampaignQuestionDto = {
  id: "notes",
  prompt: "Anything else?",
  type: "free-text",
  required: false,
}
const questions = [clarity, notes]

describe("the form that rates a session", () => {
  it("starts blank, with one answer per question", () => {
    expect(ratedFeedbackValuesOf(questions, null)).toEqual({
      overallRating: null,
      comment: "",
      answers: { clarity: null, notes: null },
    })
  })

  it("starts from what the person gave before", () => {
    const values = ratedFeedbackValuesOf(questions, {
      overallRating: 4,
      comment: "Good",
      answers: [{ questionId: "clarity", value: 5 }],
    })

    expect(values).toEqual({
      overallRating: 4,
      comment: "Good",
      answers: { clarity: 5, notes: null },
    })
  })

  it("asks for the rating and for every required answer", () => {
    const schema = ratedFeedbackFormSchema(questions)

    const blank = schema.safeParse(ratedFeedbackValuesOf(questions, null))
    expect(blank.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "overallRating",
      "answers.clarity",
    ])
    expect(
      schema.safeParse({ overallRating: 3, comment: "", answers: { clarity: 4, notes: null } })
        .success,
    ).toBe(true)
  })

  it("sends the answers given, and no comment when it is blank", () => {
    const input = ratedFeedbackInputOf(questions, {
      overallRating: 3,
      comment: "  ",
      answers: { clarity: 4, notes: " " },
    })

    expect(input).toEqual({
      overallRating: 3,
      comment: null,
      answers: [{ questionId: "clarity", value: 4 }],
    })
  })
})

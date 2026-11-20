import { describe, expect, it } from "vitest"
import { campaignConfigInputOf, campaignFormValuesOf, questionInputOf } from "./campaign-form"
import { campaignFormSchema, parseEmails, parseOptions } from "./schemas"

const question = {
  id: "q1",
  prompt: "Did the agent address your question?",
  type: "single-choice" as const,
  required: true,
  isFactual: true,
  optionsText: "Yes, Partially , ,No",
}

describe("the campaign form", () => {
  it("splits the options of a single choice at each comma", () => {
    expect(parseOptions(question.optionsText)).toEqual(["Yes", "Partially", "No"])
  })

  it("sends the options and the factual mark only where they mean something", () => {
    expect(questionInputOf(question, { hasFactual: true })).toEqual({
      id: "q1",
      prompt: "Did the agent address your question?",
      type: "single-choice",
      required: true,
      options: ["Yes", "Partially", "No"],
      isFactual: true,
    })
    expect(questionInputOf({ ...question, type: "free-text" }, { hasFactual: true })).toEqual({
      id: "q1",
      prompt: "Did the agent address your question?",
      type: "free-text",
      required: true,
    })
    expect(questionInputOf(question, { hasFactual: false })).not.toHaveProperty("isFactual")
  })

  it("refuses a question with no prompt, and a single choice with one option", () => {
    const values = {
      name: "Spring pilot",
      description: "",
      testerPerSessionQuestions: [{ ...question, prompt: " " }],
      testerEndOfPhaseQuestions: [{ ...question, optionsText: "Yes" }],
      reviewerQuestions: [],
    }

    const result = campaignFormSchema.safeParse(values)

    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "testerPerSessionQuestions.0.prompt",
      "testerEndOfPhaseQuestions.0.optionsText",
    ])
  })

  it("sends no description when it is blank, and reads a campaign back into the form", () => {
    const values = {
      name: "Spring pilot",
      description: "  ",
      testerPerSessionQuestions: [question],
      testerEndOfPhaseQuestions: [],
      reviewerQuestions: [],
    }
    const input = campaignConfigInputOf(values)

    expect(input.description).toBeNull()
    expect(
      campaignFormValuesOf({
        id: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        agentId: crypto.randomUUID(),
        status: "draft",
        createdAt: 0,
        updatedAt: 0,
        ...input,
      }).testerPerSessionQuestions,
    ).toEqual([{ ...question, optionsText: "Yes, Partially, No" }])
  })
})

describe("parseEmails", () => {
  it("splits at spaces, commas and semicolons, lowers the case and drops the doubles", () => {
    expect(parseEmails("Ana@example.org, ben@example.org;\nana@example.org")).toEqual([
      "ana@example.org",
      "ben@example.org",
    ])
  })
})

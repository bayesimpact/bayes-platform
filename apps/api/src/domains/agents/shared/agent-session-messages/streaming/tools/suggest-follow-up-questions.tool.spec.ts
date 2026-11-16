import {
  cleanFollowUpQuestions,
  FOLLOW_UP_QUESTION_MAX_LENGTH,
  suggestFollowUpQuestionsInstruction,
  suggestFollowUpQuestionsTool,
} from "./suggest-follow-up-questions.tool"

describe("cleanFollowUpQuestions", () => {
  it("trims, drops empty and duplicate questions, and keeps the order", () => {
    expect(
      cleanFollowUpQuestions(["  What is a deductible? ", "", "what is a deductible?", "Next?"], 4),
    ).toEqual(["What is a deductible?", "Next?"])
  })

  it("drops questions too long for a chip", () => {
    const tooLong = "a".repeat(FOLLOW_UP_QUESTION_MAX_LENGTH + 1)
    expect(cleanFollowUpQuestions([tooLong, "Short?"], 4)).toEqual(["Short?"])
  })

  it("keeps no more questions than the maximum", () => {
    expect(cleanFollowUpQuestions(["One?", "Two?", "Three?"], 2)).toEqual(["One?", "Two?"])
  })
})

describe("suggestFollowUpQuestionsTool", () => {
  it("logs the cleaned questions", async () => {
    const onExecute = jest.fn()
    const sdkTool = suggestFollowUpQuestionsTool({ followUpSuggestionsMax: 2, onExecute })

    await sdkTool.execute?.({ questions: ["One?", "Two?", "Three?"] }, {} as never)

    expect(onExecute).toHaveBeenCalledWith({
      toolName: "suggestFollowUpQuestions",
      arguments: { questions: ["One?", "Two?"] },
    })
  })

  it("logs nothing when no question is left", async () => {
    const onExecute = jest.fn()
    const sdkTool = suggestFollowUpQuestionsTool({ followUpSuggestionsMax: 2, onExecute })

    await sdkTool.execute?.({ questions: ["  "] }, {} as never)

    expect(onExecute).not.toHaveBeenCalled()
  })
})

describe("suggestFollowUpQuestionsInstruction", () => {
  it("states the maximum", () => {
    const instruction = suggestFollowUpQuestionsInstruction({
      followUpSuggestionsInstructions: null,
      followUpSuggestionsMax: 3,
    })
    expect(instruction).toContain("at most 3 short follow-up questions")
    expect(instruction).not.toContain("Instructions for these questions")
  })

  it("adds the author's instructions", () => {
    const instruction = suggestFollowUpQuestionsInstruction({
      followUpSuggestionsInstructions: "  Only when the answer has a difficult term. ",
      followUpSuggestionsMax: 2,
    })
    expect(instruction).toContain(
      "Instructions for these questions: Only when the answer has a difficult term.",
    )
  })
})

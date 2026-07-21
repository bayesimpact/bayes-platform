import { AgentModel } from "@caseai-connect/api-contracts"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { EvaluationConversationRunGraderService } from "./evaluation-conversation-run-grader.service"

const connectScope: RequiredConnectScope = {
  organizationId: "org-1",
  projectId: "project-1",
}

describe("EvaluationConversationRunGraderService", () => {
  let grader: EvaluationConversationRunGraderService
  let mockProvider: { generateText: jest.Mock }
  let vertexProvider: { generateText: jest.Mock }

  beforeEach(() => {
    mockProvider = { generateText: jest.fn() }
    vertexProvider = { generateText: jest.fn() }
    grader = new EvaluationConversationRunGraderService(
      mockProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
    )
  })

  const gradeWith = (generatorModel: AgentModel = AgentModel.Gemini25Flash) =>
    grader.gradeOutput({
      expectedOutput: "The expected answer",
      generatedOutput: "The generated answer",
      generatorModel,
      traceId: "trace-1",
      connectScope,
    })

  it("should parse an integer score from the rating agent response", async () => {
    vertexProvider.generateText.mockResolvedValue("4")

    await expect(gradeWith()).resolves.toBe(4)
  })

  it("should trim whitespace around the score", async () => {
    vertexProvider.generateText.mockResolvedValue("  3\n")

    await expect(gradeWith()).resolves.toBe(3)
  })

  it("should round a non-integer score to an integer", async () => {
    vertexProvider.generateText.mockResolvedValue("3.6")

    await expect(gradeWith()).resolves.toBe(4)
  })

  it("should clamp scores above 5", async () => {
    vertexProvider.generateText.mockResolvedValue("8")

    await expect(gradeWith()).resolves.toBe(5)
  })

  it("should clamp scores below 0", async () => {
    vertexProvider.generateText.mockResolvedValue("-10")

    await expect(gradeWith()).resolves.toBe(0)
  })

  it("should throw on an unparsable response", async () => {
    vertexProvider.generateText.mockResolvedValue("I cannot rate this")

    await expect(gradeWith()).rejects.toThrow(/unparsable score/)
  })

  it("should use the rating agent config with the expected and generated values in the prompt", async () => {
    vertexProvider.generateText.mockResolvedValue("3")

    await gradeWith()

    expect(vertexProvider.generateText).toHaveBeenCalledTimes(1)
    const callArguments = vertexProvider.generateText.mock.calls[0]![0]
    expect(callArguments.config.model).toBe(AgentModel.Gemini25Flash)
    expect(callArguments.config.temperature).toBe(0)
    expect(callArguments.prompt).toContain("<%ratingInstructions>")
    expect(callArguments.prompt).toContain("The expected answer")
    expect(callArguments.prompt).toContain("<%value>")
    expect(callArguments.prompt).toContain("The generated answer")
    expect(callArguments.metadata.tags).toEqual(["*Rating Agent*"])
    expect(callArguments.metadata.traceId).toBe("trace-1")
  })

  it("should swap to the mock model with a **TEST** tag when the generator uses the mock provider", async () => {
    mockProvider.generateText.mockResolvedValue("5")

    await expect(gradeWith(AgentModel._Mock)).resolves.toBe(5)

    expect(vertexProvider.generateText).not.toHaveBeenCalled()
    expect(mockProvider.generateText).toHaveBeenCalledTimes(1)
    const callArguments = mockProvider.generateText.mock.calls[0]![0]
    expect(callArguments.config.model).toBe(AgentModel._Mock)
    expect(callArguments.metadata.tags).toEqual(["**TEST**", "*Rating Agent*"])
  })
})

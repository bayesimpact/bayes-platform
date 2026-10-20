import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { EvaluationConversationRunGraderLlmService } from "./evaluation-conversation-run-grader-llm.service"

const connectScope: RequiredConnectScope = {
  organizationId: "org-1",
  projectId: "project-1",
}

describe("EvaluationConversationRunGraderLLMService", () => {
  let grader: EvaluationConversationRunGraderLlmService
  type FakeProvider = { generateText: jest.Mock; getInternalCallModelOptions: jest.Mock }
  let mockProvider: FakeProvider
  let vertexProvider: FakeProvider
  let vertex3Provider: FakeProvider

  // The internal call options each provider gives: a temperature of 0, nothing on Gemini 3.
  const fakeProvider = (internalCallModelOptions: Record<string, unknown>): FakeProvider => ({
    generateText: jest.fn(),
    getInternalCallModelOptions: jest.fn(() => internalCallModelOptions),
  })

  beforeEach(() => {
    mockProvider = fakeProvider({ temperature: 0 })
    vertexProvider = fakeProvider({ temperature: 0 })
    vertex3Provider = fakeProvider({})
    grader = new EvaluationConversationRunGraderLlmService({
      [AgentProvider._Mock]: mockProvider as unknown as LLMProvider,
      [AgentProvider.Vertex]: vertexProvider as unknown as LLMProvider,
      [AgentProvider.Vertex3]: vertex3Provider as unknown as LLMProvider,
      [AgentProvider.Mistral]: vertexProvider as unknown as LLMProvider,
      [AgentProvider.MedGemma]: vertexProvider as unknown as LLMProvider,
      [AgentProvider.Gemma]: vertexProvider as unknown as LLMProvider,
    })
  })

  const gradeWith = (
    generatorModel: AgentModel = AgentModel.Gemini25Flash,
    judgeModel: AgentModel = AgentModel.Gemini25Flash,
  ) =>
    grader.gradeOutput({
      expectedOutput: "The expected answer",
      generatedOutput: "The generated answer",
      generatorModel,
      judgeModel,
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
    expect(callArguments.config.modelOptions).toEqual({ temperature: 0 })
    expect(callArguments.prompt).toContain("<%ratingInstructions>")
    expect(callArguments.prompt).toContain("The expected answer")
    expect(callArguments.prompt).toContain("<%value>")
    expect(callArguments.prompt).toContain("The generated answer")
    expect(callArguments.metadata.tags).toEqual(["*Rating Agent*"])
    expect(callArguments.metadata.traceId).toBe("trace-1")
  })

  it("should inject the judge instructions into the prompt when provided", async () => {
    vertexProvider.generateText.mockResolvedValue("3")

    await grader.gradeOutput({
      expectedOutput: "The expected answer",
      generatedOutput: "The generated answer",
      generatorModel: AgentModel.Gemini25Flash,
      judgeModel: AgentModel.Gemini25Flash,
      judgeInstructions: "Penalize answers longer than two sentences",
      traceId: "trace-1",
      connectScope,
    })

    expect(vertexProvider.generateText).toHaveBeenCalledTimes(1)
    const callArguments = vertexProvider.generateText.mock.calls[0]![0]
    expect(callArguments.prompt).toContain("<%judgeInstructions>")
    expect(callArguments.prompt).toContain("Penalize answers longer than two sentences")
    expect(callArguments.config.systemPrompt).toContain("'%judgeInstructions'")
  })

  it("should omit the judge instructions block when none are provided", async () => {
    vertexProvider.generateText.mockResolvedValue("3")

    await gradeWith()

    const callArguments = vertexProvider.generateText.mock.calls[0]![0]
    expect(callArguments.prompt).not.toContain("<%judgeInstructions>")
    expect(callArguments.config.systemPrompt).not.toContain("'%judgeInstructions'")
  })

  it("should use the selected judge model as the rating agent config model", async () => {
    vertexProvider.generateText.mockResolvedValue("3")

    await gradeWith(AgentModel.Gemini25Flash, AgentModel.Gemini25Pro)

    expect(vertexProvider.generateText).toHaveBeenCalledTimes(1)
    const callArguments = vertexProvider.generateText.mock.calls[0]![0]
    expect(callArguments.config.model).toBe(AgentModel.Gemini25Pro)
  })

  it("should run a Gemini 3 judge on the options its provider gives internal calls", async () => {
    vertex3Provider.generateText.mockResolvedValue("3")

    await gradeWith(AgentModel.Gemini25Flash, AgentModel.Gemini35Flash)

    expect(vertex3Provider.getInternalCallModelOptions).toHaveBeenCalledWith(
      AgentModel.Gemini35Flash,
    )
    const callArguments = vertex3Provider.generateText.mock.calls[0]![0]
    expect(callArguments.config.modelOptions).toEqual({})
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

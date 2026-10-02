import { AgentModel, AgentThinkingLevel } from "@caseai-connect/api-contracts"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { LlmServiceBase } from "./llm-service-base"

class TestLlmService extends LlmServiceBase {
  constructor() {
    const provider = {} as LLMProvider
    super({
      mockLlmProvider: provider,
      vertexLlmProvider: provider,
      vertex3LlmProvider: provider,
      mistralLlmProvider: provider,
      medGemmaLlmProvider: provider,
      gemmaLlmProvider: provider,
    })
  }

  build(params: BuildLLMConfigParams): LLMConfig {
    return this.buildLLMConfig(params)
  }
}

describe("LlmServiceBase.buildLLMConfig", () => {
  const baseParams: BuildLLMConfigParams = {
    model: AgentModel.Gemini35FlashLite,
    systemPrompt: "You are a helpful assistant.",
    temperature: 0,
    priorityCallsEnabled: false,
    llmFeatures: {},
  }

  it("carries the agent's thinking level", () => {
    const config = new TestLlmService().build({
      ...baseParams,
      thinkingLevel: AgentThinkingLevel.High,
    })

    expect(config.thinkingLevel).toBe(AgentThinkingLevel.High)
  })

  it("falls back to Auto when no thinking level is given", () => {
    const config = new TestLlmService().build(baseParams)

    expect(config.thinkingLevel).toBe(AgentThinkingLevel.Auto)
  })
})

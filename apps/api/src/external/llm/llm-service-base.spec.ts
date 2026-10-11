import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { LlmProviders } from "@/external/llm/llm.module"
import { LlmServiceBase } from "./llm-service-base"

const providerNamed = (name: string) => ({ name }) as unknown as LLMProvider

const llmProviders: LlmProviders = {
  [AgentProvider._Mock]: providerNamed("mock"),
  [AgentProvider.Vertex]: providerNamed("vertex"),
  [AgentProvider.Vertex3]: providerNamed("vertex3"),
  [AgentProvider.Mistral]: providerNamed("mistral"),
  [AgentProvider.MedGemma]: providerNamed("medgemma"),
  [AgentProvider.Gemma]: providerNamed("gemma"),
}

class TestLlmService extends LlmServiceBase {
  constructor() {
    super(llmProviders)
  }

  build(params: BuildLLMConfigParams): LLMConfig {
    return this.buildLLMConfig(params)
  }
  providerFor(model: string): LLMProvider {
    return this.getProviderForModel(model)
  }
}

describe("LlmServiceBase.getProviderForModel", () => {
  it.each([
    [AgentModel._Mock, "mock"],
    [AgentModel.Gemini25Flash, "vertex"],
    [AgentModel.Gemini35FlashLite, "vertex3"],
    [AgentModel.MistralSmall31_24B, "mistral"],
    [AgentModel.MedGemma10_27B, "medgemma"],
    [AgentModel.Gemma4_26B, "gemma"],
  ])("serves %s with the %s provider", (model, providerName) => {
    const provider = new TestLlmService().providerFor(model) as unknown as { name: string }
    expect(provider.name).toBe(providerName)
  })

  it("rejects a model outside the catalog", () => {
    expect(() => new TestLlmService().providerFor("unknown-model")).toThrow(
      "not supported llm model: unknown-model",
    )
  })
})

describe("LlmServiceBase.buildLLMConfig", () => {
  const baseParams: BuildLLMConfigParams = {
    model: AgentModel.Gemini35FlashLite,
    systemPrompt: "You are a helpful assistant.",
    modelOptions: { temperature: 0 },
    priorityCallsEnabled: false,
    llmFeatures: {},
  }

  it("carries the call settings through", () => {
    const config = new TestLlmService().build({
      ...baseParams,
      fireAndForgetToolNames: ["sources"],
      terminalToolNames: ["take_over_form"],
      useExtendedTimeouts: true,
    })

    expect(config).toMatchObject({
      model: AgentModel.Gemini35FlashLite,
      systemPrompt: "You are a helpful assistant.",
      modelOptions: { temperature: 0 },
      fireAndForgetToolNames: ["sources"],
      terminalToolNames: ["take_over_form"],
      useExtendedTimeouts: true,
    })
  })

  it("leaves the model options out when the agent stores none", () => {
    const config = new TestLlmService().build({ ...baseParams, modelOptions: null })

    expect(config.modelOptions).toBeUndefined()
  })

  describe("service tier", () => {
    const priorityParams: BuildLLMConfigParams = {
      ...baseParams,
      model: AgentModel.Gemini35FlashLite,
      priorityCallsEnabled: true,
      llmFeatures: { priorityCalls: true },
    }

    it("asks for priority on a Vertex3 model when the agent and the feature allow it", () => {
      expect(new TestLlmService().build(priorityParams).serviceTier).toBe("priority")
    })

    it.each<[string, Partial<BuildLLMConfigParams>]>([
      ["the agent does not enable it", { priorityCallsEnabled: false }],
      ["the feature is off", { llmFeatures: {} }],
      ["the model is not served by Vertex3", { model: AgentModel.Gemini25Flash }],
    ])("asks for no tier when %s", (_case, overrides) => {
      expect(
        new TestLlmService().build({ ...priorityParams, ...overrides }).serviceTier,
      ).toBeUndefined()
    })
  })
})

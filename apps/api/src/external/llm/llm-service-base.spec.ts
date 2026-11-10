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
  [AgentProvider.Qwen]: providerNamed("qwen"),
  [AgentProvider.Anthropic]: providerNamed("anthropic"),
  [AgentProvider.OpenAI]: providerNamed("openai"),
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
    [AgentModel.MistralSmall32_24B, "mistral"],
    [AgentModel.MedGemma10_27B, "medgemma"],
    [AgentModel.Gemma4_26B, "gemma"],
    [AgentModel.Gemma4_31B, "gemma"],
    [AgentModel.Qwen38_27B, "qwen"],
    [AgentModel.ClaudeSonnet55, "anthropic"],
    [AgentModel.Gpt54Mini, "openai"],
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

    it.each([
      AgentModel.Gpt54,
      AgentModel.Gpt54Mini,
    ])("asks for priority on the OpenAI model %s when the agent and the feature allow it", (model) => {
      expect(new TestLlmService().build({ ...priorityParams, model }).serviceTier).toBe("priority")
    })

    it.each<[string, Partial<BuildLLMConfigParams>]>([
      ["the agent does not enable it", { priorityCallsEnabled: false }],
      ["the feature is off", { llmFeatures: {} }],
      ["the model is not served by Vertex3", { model: AgentModel.Gemini25Flash }],
      ["the model is a Claude one", { model: AgentModel.ClaudeSonnet55 }],
      ["the model is a vLLM one", { model: AgentModel.Gemma4_26B }],
    ])("asks for no tier when %s", (_case, overrides) => {
      expect(
        new TestLlmService().build({ ...priorityParams, ...overrides }).serviceTier,
      ).toBeUndefined()
    })
  })

  describe("flex tier for worker calls", () => {
    const ENV_KEYS = ["LLM_WORKERS_NB_RETRIES", "LLM_WORKERS_ENABLE_FALLBACK_NORMAL_AFTER_RETRIES"]
    const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
    afterEach(() => {
      for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) delete process.env[key]
        else process.env[key] = savedEnv[key]
      }
    })

    const flexParams: BuildLLMConfigParams = {
      ...baseParams,
      isWorkerCall: true,
      llmFeatures: { flexWorkers: true },
    }

    it.each([
      AgentModel.Gemini35FlashLite,
      AgentModel.Gemini38Flash,
      AgentModel.Gpt54,
      AgentModel.Gpt54Mini,
    ])("asks for flex with the extended timeouts on %s", (model) => {
      expect(new TestLlmService().build({ ...flexParams, model })).toMatchObject({
        serviceTier: "flex",
        useExtendedTimeouts: true,
      })
    })

    it("takes flex over the priority the agent asks for", () => {
      const config = new TestLlmService().build({
        ...flexParams,
        priorityCallsEnabled: true,
        llmFeatures: { flexWorkers: true, priorityCalls: true },
      })
      expect(config.serviceTier).toBe("flex")
    })

    it("reads the retries and the fallback from the environment", () => {
      process.env.LLM_WORKERS_NB_RETRIES = "3"
      process.env.LLM_WORKERS_ENABLE_FALLBACK_NORMAL_AFTER_RETRIES = "true"

      expect(new TestLlmService().build(flexParams)).toMatchObject({
        nbRetriesOnSpecificErrors: 3,
        fallbackToStandardTier: true,
      })
    })

    it("asks for no retry and no fallback by default", () => {
      delete process.env.LLM_WORKERS_NB_RETRIES
      delete process.env.LLM_WORKERS_ENABLE_FALLBACK_NORMAL_AFTER_RETRIES

      expect(new TestLlmService().build(flexParams)).toMatchObject({
        nbRetriesOnSpecificErrors: 0,
        fallbackToStandardTier: false,
      })
    })

    it.each<[string, Partial<BuildLLMConfigParams>]>([
      ["the call is not a worker call", { isWorkerCall: false }],
      ["the call does not say", { isWorkerCall: undefined }],
      ["the project has no flex flag", { llmFeatures: {} }],
      ["the model is a Claude one", { model: AgentModel.ClaudeSonnet55 }],
      ["the model is a Gemini 2.5 one", { model: AgentModel.Gemini25Flash }],
      ["the model is a vLLM one", { model: AgentModel.Gemma4_26B }],
    ])("asks for no flex when %s", (_case, overrides) => {
      const config = new TestLlmService().build({ ...flexParams, ...overrides })
      expect(config.serviceTier).toBeUndefined()
      expect(config.nbRetriesOnSpecificErrors).toBeUndefined()
    })

    it("keeps the agent's priority on a non-worker call of a flex project", () => {
      const config = new TestLlmService().build({
        ...baseParams,
        priorityCallsEnabled: true,
        llmFeatures: { flexWorkers: true, priorityCalls: true },
      })
      expect(config.serviceTier).toBe("priority")
    })
  })
})

import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { AGENT_DEFAULT_MODELS } from "@/domains/agents/settings/agent-models.service"
import type { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import { AISDKGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { AISDKQwenProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-qwen.provider"
import { AISDKVertexProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"

const providers: { [Provider in AgentProvider]: AISDKLLMProviderBase<Provider> } = {
  [AgentProvider.Gemma]: new AISDKGemmaProvider(),
  [AgentProvider.MedGemma]: new AISDKMedGemmaProvider(),
  [AgentProvider.Mistral]: new AISDKMistralProvider(),
  [AgentProvider.Qwen]: new AISDKQwenProvider(),
  [AgentProvider.Vertex]: new AISDKVertexProvider(),
  [AgentProvider.Vertex3]: new AISDKVertex3Provider(),
  [AgentProvider._Mock]: new AISDKMockProvider(),
}

const ALL_THINKING_LEVELS = ["minimal", "low", "medium", "high"]

const vertex3Options = ({
  temperature,
  thinkingLevel,
}: {
  temperature?: number
  thinkingLevel: string
}) => ({
  ...(temperature !== undefined ? { temperature } : {}),
  providerOptions: { vertex: { thinkingConfig: { thinkingLevel, includeThoughts: true } } },
})

/**
 * The catalog as it stands, model by model: moving where it is declared (the
 * metadata, the default model, the options) must not change any of it.
 */
const CATALOG: {
  model: AgentModel
  provider: AgentProvider
  deprecation?: { deprecatedOn: string; recommendedReplacement: AgentModel }
  isDefault: boolean
  defaultOptions: Record<string, unknown>
  thinkingLevels?: string[]
}[] = [
  {
    model: AgentModel.Gemini25Flash,
    provider: AgentProvider.Vertex,
    deprecation: {
      deprecatedOn: "2026-09-30",
      recommendedReplacement: AgentModel.Gemini35FlashLite,
    },
    isDefault: false,
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.Gemini25Pro,
    provider: AgentProvider.Vertex,
    deprecation: { deprecatedOn: "2026-09-30", recommendedReplacement: AgentModel.Gemini35Flash },
    isDefault: false,
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.Gemini31FlashLite,
    provider: AgentProvider.Vertex3,
    isDefault: false,
    defaultOptions: vertex3Options({ temperature: 1, thinkingLevel: "minimal" }),
    thinkingLevels: ALL_THINKING_LEVELS,
  },
  {
    model: AgentModel.Gemini35FlashLite,
    provider: AgentProvider.Vertex3,
    isDefault: true,
    defaultOptions: vertex3Options({ thinkingLevel: "minimal" }),
    thinkingLevels: ALL_THINKING_LEVELS,
  },
  {
    model: AgentModel.Gemini35Flash,
    provider: AgentProvider.Vertex3,
    isDefault: false,
    defaultOptions: vertex3Options({ temperature: 1, thinkingLevel: "medium" }),
    thinkingLevels: ALL_THINKING_LEVELS,
  },
  {
    model: AgentModel.Gemini36Flash,
    provider: AgentProvider.Vertex3,
    isDefault: false,
    defaultOptions: vertex3Options({ thinkingLevel: "medium" }),
    thinkingLevels: ALL_THINKING_LEVELS,
  },
  {
    model: AgentModel.Gemini37Flash,
    provider: AgentProvider.Vertex3,
    isDefault: false,
    defaultOptions: vertex3Options({ thinkingLevel: "medium" }),
    thinkingLevels: ["low", "medium", "high"],
  },
  {
    model: AgentModel.Gemini38Flash,
    provider: AgentProvider.Vertex3,
    isDefault: false,
    defaultOptions: vertex3Options({ thinkingLevel: "medium" }),
    thinkingLevels: ["low", "medium", "high"],
  },
  {
    model: AgentModel.MedGemma10_27B,
    provider: AgentProvider.MedGemma,
    deprecation: {
      deprecatedOn: "2026-10-23",
      recommendedReplacement: AgentModel.Gemma4_26B,
    },
    isDefault: false,
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.Gemma4_26B,
    provider: AgentProvider.Gemma,
    isDefault: false,
    defaultOptions: { temperature: 1 },
  },
  {
    model: AgentModel.Gemma4_31B,
    provider: AgentProvider.Gemma,
    isDefault: false,
    defaultOptions: { temperature: 1 },
  },
  {
    model: AgentModel.MistralSmall31_24B,
    provider: AgentProvider.Mistral,
    deprecation: {
      deprecatedOn: "2026-10-20",
      recommendedReplacement: AgentModel.MistralSmall32_24B,
    },
    isDefault: false,
    defaultOptions: { temperature: 0 },
  },
  {
    model: AgentModel.MistralSmall32_24B,
    provider: AgentProvider.Mistral,
    isDefault: false,
    defaultOptions: { temperature: 0.15 },
  },
  {
    model: AgentModel.Qwen38_27B,
    provider: AgentProvider.Qwen,
    isDefault: false,
    defaultOptions: { temperature: 0.7 },
  },
  {
    model: AgentModel._Mock,
    provider: AgentProvider._Mock,
    isDefault: false,
    defaultOptions: { temperature: 0 },
  },
]

describe("agent model catalog", () => {
  it("lists every model exactly once", () => {
    expect(CATALOG.map((entry) => entry.model).sort()).toEqual(Object.values(AgentModel).sort())
  })

  it.each(CATALOG)("$model is served by its provider", ({ model, provider }) => {
    expect(AgentModelToAgentProvider[model]).toBe(provider)
  })

  it.each(CATALOG)("$model carries its deprecation", ({ model, provider, deprecation }) => {
    expect(providers[provider].getModelInfos(model).deprecation).toEqual(deprecation)
  })

  it.each(CATALOG)("$model is served in the EU", ({ model, provider }) => {
    expect(providers[provider].getModelInfos(model).servedOutsideEu === true).toBe(false)
  })

  it("has one default model", () => {
    const defaults = CATALOG.filter((entry) => entry.isDefault).map((entry) => entry.model)
    expect(defaults).toEqual([AGENT_DEFAULT_MODELS.agent])
  })

  it("judges evaluation runs with Gemini 3.5 Flash-Lite by default", () => {
    expect(AGENT_DEFAULT_MODELS.judge).toBe(AgentModel.Gemini35FlashLite)
  })

  it.each(
    Object.entries(AGENT_DEFAULT_MODELS),
  )("picks a %s default that is supported and never behind a feature flag", (_role, model) => {
    const entry = CATALOG.find((catalogEntry) => catalogEntry.model === model)
    expect(entry?.deprecation).toBeUndefined()
    expect([AgentProvider.Vertex, AgentProvider.Vertex3]).toContain(entry?.provider)
  })

  it.each(CATALOG)("$model has its default options", ({ model, provider, defaultOptions }) => {
    expect(providers[provider].getModelOptions(model)).toEqual(defaultOptions)
  })

  it.each(
    CATALOG.filter((entry) => entry.thinkingLevels),
  )("$model accepts its thinking levels only", ({
    model,
    provider,
    defaultOptions,
    thinkingLevels,
  }) => {
    const schema = providers[provider].getModelOptionsSchema(model)
    const accepted = ALL_THINKING_LEVELS.filter(
      (thinkingLevel) =>
        schema.safeParse({
          ...defaultOptions,
          providerOptions: {
            vertex: { thinkingConfig: { thinkingLevel, includeThoughts: true } },
          },
        }).success,
    )
    expect(accepted).toEqual(thinkingLevels)
  })
})

describe("AISDKLLMProviderBase model options", () => {
  it.each(Object.values(AgentModel))("%s values conform to its schema", (agentModel) => {
    const provider = providers[AgentModelToAgentProvider[agentModel]]

    const schema = provider.getModelOptionsSchema(agentModel)
    const values = provider.getModelOptions(agentModel)

    expect(schema.parse(values)).toEqual(values)
  })
})

import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { getAgentModelKey } from "@/external/llm/agent-provider"
import { AISDKVertex4Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex4.provider"
import { ProviderSpecs } from "@/external/llm/ai-sdk/providers/provider-specs"
import { gcpCredentialsCheck } from "@/external/llm/ai-sdk/providers/spec-gcp-tools"

const vertex4Models = Object.values(AgentModel).filter(
  (model) => AgentModelToAgentProvider[model] === AgentProvider.Vertex4,
)

const configFor = (model: AgentModel, modelOptions?: LLMConfig["modelOptions"]): LLMConfig => ({
  model,
  modelOptions,
  serviceTier: undefined,
})

describe("AISDKVertex4Provider location routing", () => {
  const provider = new AISDKVertex4Provider()

  it("serves the Gemini 4 models", () => {
    expect(vertex4Models).toEqual([
      AgentModel.Gemini4Argon,
      AgentModel.Gemini4Carbon,
      AgentModel.Gemini4Hydrogen,
    ])
  })

  it.each([
    AgentModel.Gemini4Argon,
    AgentModel.Gemini4Hydrogen,
  ])("keeps %s on the eu endpoint", (model) => {
    expect(provider.getModelMetadata(configFor(model)).location).toBe("eu")
    expect(provider.getModelInfos(model).servedOutsideEu).toBeFalsy()
  })

  it("routes gemini-4-carbon through the global endpoint, outside the EU", () => {
    expect(provider.getModelMetadata(configFor(AgentModel.Gemini4Carbon)).location).toBe("global")
    expect(provider.getModelInfos(AgentModel.Gemini4Carbon).servedOutsideEu).toBe(true)
  })
})

describe("AISDKVertex4Provider options", () => {
  class TestableProvider extends AISDKVertex4Provider {
    public specificProviderOptionsFor(config: LLMConfig) {
      return this.buildSpecificProviderOptions({ config })
    }
  }
  const provider = new TestableProvider()

  // Google refuses flex for the Gemini 4 models: the LLM service never asks for it.
  it.each(
    vertex4Models.map((model) => [model, "priority"]) as [AgentModel, "priority"][],
  )("sends %s with the %s shared request type of the call", (model, serviceTier) => {
    expect(provider.specificProviderOptionsFor({ ...configFor(model), serviceTier })).toMatchObject(
      { providerOptions: { vertex: { sharedRequestType: serviceTier } } },
    )
  })

  it.each(vertex4Models)("sends %s with no shared request type by default", (model) => {
    const options = provider.specificProviderOptionsFor(configFor(model)) as {
      providerOptions: { vertex: Record<string, unknown> }
    }
    expect(options.providerOptions.vertex).not.toHaveProperty("sharedRequestType")
  })

  it.each(vertex4Models)("sends no temperature to %s", (model) => {
    expect(
      provider.specificProviderOptionsFor(configFor(model, { temperature: 0.4 })),
    ).not.toHaveProperty("temperature")
  })

  const withLevel = (thinkingLevel: string) => ({
    providerOptions: { vertex: { thinkingConfig: { thinkingLevel, includeThoughts: true } } },
  })

  // Carbon is too slow on high (no answer within 120 s): it defaults to low and stops at medium.
  it.each([
    [AgentModel.Gemini4Argon, "medium", ["low", "medium", "high"]],
    [AgentModel.Gemini4Hydrogen, "medium", ["low", "medium", "high"]],
    [AgentModel.Gemini4Carbon, "low", ["low", "medium"]],
  ])("defaults %s to %s and accepts only %j", (model, defaultLevel, levels) => {
    expect(provider.getModelOptions(model)).toEqual(withLevel(defaultLevel))

    const schema = provider.getModelOptionsSchema(model)
    for (const level of ["minimal", "low", "medium", "high"]) {
      expect(schema.safeParse(withLevel(level)).success).toBe(levels.includes(level))
    }
  })
})

describe("AISDKVertex4Provider stored model options", () => {
  class TestableProvider extends AISDKVertex4Provider {
    public specificProviderOptionsFor(config: LLMConfig) {
      return this.buildSpecificProviderOptions({ config })
    }
  }
  const provider = new TestableProvider()
  const storedLevel = (thinkingLevel: string, sharedRequestType?: string) => ({
    providerOptions: {
      vertex: {
        ...(sharedRequestType ? { sharedRequestType } : {}),
        thinkingConfig: { thinkingLevel, includeThoughts: true },
      },
    },
  })

  it.each([
    [AgentModel.Gemini4Argon, "high"],
    [AgentModel.Gemini4Hydrogen, "low"],
    [AgentModel.Gemini4Carbon, "medium"],
  ])("sends the stored level of %s (%s)", (model, level) => {
    expect(provider.specificProviderOptionsFor(configFor(model, storedLevel(level)))).toEqual(
      storedLevel(level),
    )
  })

  // An agent may hold a level from another model (minimal from 3.5) or from before Carbon lost high.
  it.each([
    [AgentModel.Gemini4Argon, "minimal", "medium"],
    [AgentModel.Gemini4Hydrogen, "minimal", "medium"],
    [AgentModel.Gemini4Carbon, "minimal", "low"],
    [AgentModel.Gemini4Carbon, "high", "low"],
  ])("runs %s on its default level when the stored %s is not accepted", (model, stored, level) => {
    expect(provider.specificProviderOptionsFor(configFor(model, storedLevel(stored)))).toEqual(
      storedLevel(level),
    )
  })

  it.each(vertex4Models)("ignores a tier left in the stored options of %s", (model) => {
    expect(
      provider.specificProviderOptionsFor(configFor(model, storedLevel("low", "priority"))),
    ).toEqual(storedLevel("low"))
  })

  it.each(vertex4Models)("sends the call's tier over a stored one on %s", (model) => {
    expect(
      provider.specificProviderOptionsFor({
        ...configFor(model, storedLevel("low", "flex")),
        serviceTier: "priority",
      }),
    ).toEqual(storedLevel("low", "priority"))
  })
})

describe("AISDKVertex4Provider telemetry and internal calls", () => {
  class TestableProvider extends AISDKVertex4Provider {
    public internalCallOptionsFor(model: AgentModel) {
      return this.buildSpecificProviderOptions({
        config: configFor(model, this.getInternalCallModelOptions(model)),
      })
    }
  }
  const provider = new TestableProvider()

  it.each([
    [AgentModel.Gemini4Argon, "MEDIUM"],
    [AgentModel.Gemini4Carbon, "LOW"],
    [AgentModel.Gemini4Hydrogen, "MEDIUM"],
  ])("tags a call of %s with its default level %s", (model, level) => {
    expect(provider.getModelMetadata(configFor(model)).thinkingLevel).toBe(level)
  })

  it("tags the call with its stored level and its tier", () => {
    const metadata = provider.getModelMetadata({
      model: AgentModel.Gemini4Argon,
      modelOptions: {
        providerOptions: {
          vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
        },
      },
      serviceTier: "priority",
    })
    expect(metadata).toMatchObject({ thinkingLevel: "HIGH", serviceTier: "PRIORITY" })
  })

  it.each(vertex4Models)("runs an internal call of %s on the model's defaults", (model) => {
    expect(provider.getInternalCallModelOptions(model)).toEqual({})
    expect(provider.internalCallOptionsFor(model)).toEqual(provider.getModelOptions(model))
  })

  it("throws on a model the provider does not serve", () => {
    expect(() => provider.getModelMetadata(configFor(AgentModel.Gemini38Flash))).toThrow()
  })
})

// Live calls to Vertex AI: opt in with IS_TEST=true and VERTEX4_TEST=true.
if (process.env.IS_TEST === "true" && process.env.VERTEX4_TEST === "true") {
  describe("AISDKVertex4Provider (live)", () => {
    // Carbon took up to 106 s on a one-word prompt (probe of 2026-11-19).
    jest.setTimeout(180_000)
    const provider = new AISDKVertex4Provider()
    const testModels = vertex4Models.map((model) => ({ name: getAgentModelKey(model), model }))

    it("gcpCredentialsCheck", async () => {
      expect(await gcpCredentialsCheck()).toBeTruthy()
    })

    it.each(testModels)("generateText - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateText({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -pdf - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromPdf({ provider, model })
    })

    it.each(testModels)("streamChatResponse - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponse({ provider, model })
    })

    it.each(testModels)("streamChatResponse with tools - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithTools({
        provider,
        model,
        advancedExpectation: true,
      })
    })
  })
} else {
  describe.skip("AISDKVertex4Provider (live)", () => {
    it("skipped (requires process.env.IS_TEST=true and process.env.VERTEX4_TEST=true)", () => {})
  })
}

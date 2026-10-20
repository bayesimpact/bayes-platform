import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll } from "@jest/globals"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import type { LLMConfig, LLMServiceTier } from "@/common/interfaces/llm-provider.interface"
import { getAgentModelKey } from "@/external/llm/agent-provider"
import type { ModelInfos } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"
import { ProviderSpecs } from "@/external/llm/ai-sdk/providers/provider-specs"
import { gcpCredentialsCheck } from "@/external/llm/ai-sdk/providers/spec-gcp-tools"
import { sdk } from "@/external/llm/open-telemetry-init"

const testModels = Object.values(AgentModel)
  .filter(
    (am) =>
      AgentModelToAgentProvider[am] === AgentProvider.Vertex3 &&
      process.env.VERTEX3_TEST === "true",
  )
  .map((m) => ({
    name: getAgentModelKey(m),
    model: m,
  }))

// Endpoint routing is decided from the shared model catalog, with no call to Vertex, so this
// runs everywhere — unlike the live generation specs below, which need credentials.
describe("AISDKVertex3Provider location routing", () => {
  const locationOf = (model: AgentModel) =>
    new AISDKVertex3Provider().getModelMetadata({
      model,
      modelOptions: { temperature: 0 },
      serviceTier: undefined,
    })["location"]

  it("keeps every vertex 3 model on the eu endpoint", () => {
    const vertex3Models = Object.values(AgentModel).filter(
      (model) => AgentModelToAgentProvider[model] === AgentProvider.Vertex3,
    )
    expect(vertex3Models).toContain(AgentModel.Gemini38Flash)
    for (const model of vertex3Models) {
      expect(locationOf(model)).toBe("eu")
    }
  })

  it("routes a model flagged as served outside the EU through the global endpoint", () => {
    // No model carries the flag today: a provider declaring it is enough to test the routing.
    class ProviderServingOutsideEu extends AISDKVertex3Provider {
      protected override readonly modelInfos: Record<
        | AgentModel.Gemini31FlashLite
        | AgentModel.Gemini35FlashLite
        | AgentModel.Gemini35Flash
        | AgentModel.Gemini36Flash
        | AgentModel.Gemini37Flash
        | AgentModel.Gemini38Flash,
        ModelInfos
      > = {
        [AgentModel.Gemini31FlashLite]: {},
        [AgentModel.Gemini35FlashLite]: {},
        [AgentModel.Gemini35Flash]: {},
        [AgentModel.Gemini36Flash]: { servedOutsideEu: true },
        [AgentModel.Gemini37Flash]: {},
        [AgentModel.Gemini38Flash]: {},
      }
    }
    const provider = new ProviderServingOutsideEu()
    const config: LLMConfig = { model: AgentModel.Gemini36Flash, serviceTier: undefined }

    expect(provider.getModelMetadata(config)["location"]).toBe("global")
    expect(provider.getModelInfos(AgentModel.Gemini36Flash).servedOutsideEu).toBe(true)
  })
})

describe("AISDKVertex3Provider temperature", () => {
  class TestableProvider extends AISDKVertex3Provider {
    public specificProviderOptionsFor(config: LLMConfig) {
      return this.buildSpecificProviderOptions({ config })
    }
  }

  const buildConfig = (model: AgentModel): LLMConfig => ({
    model,
    modelOptions: { temperature: 0.4 },
    serviceTier: undefined,
  })

  it.each([
    AgentModel.Gemini35FlashLite,
    AgentModel.Gemini36Flash,
    AgentModel.Gemini37Flash,
    AgentModel.Gemini38Flash,
  ])("sends no temperature to %s, which Google deprecated it for", (model) => {
    expect(
      new TestableProvider().specificProviderOptionsFor(buildConfig(model)),
    ).not.toHaveProperty("temperature")
  })

  it.each([
    AgentModel.Gemini31FlashLite,
    AgentModel.Gemini35Flash,
  ])("sends the configured temperature to %s", (model) => {
    expect(new TestableProvider().specificProviderOptionsFor(buildConfig(model))).toMatchObject({
      temperature: 0.4,
    })
  })
})

describe("AISDKVertex3Provider stored model options", () => {
  class TestableProvider extends AISDKVertex3Provider {
    public specificProviderOptionsFor(config: LLMConfig) {
      return this.buildSpecificProviderOptions({ config })
    }
  }

  const storedThinkingLevel = (thinkingLevel: string) => ({
    providerOptions: { vertex: { thinkingConfig: { thinkingLevel, includeThoughts: true } } },
  })
  const buildConfig = ({
    model,
    modelOptions,
    serviceTier,
  }: {
    model: AgentModel
    modelOptions: Record<string, unknown>
    serviceTier?: LLMServiceTier
  }): LLMConfig => ({
    model,
    modelOptions,
    serviceTier,
  })

  it("sends the stored temperature and thinking level", () => {
    expect(
      new TestableProvider().specificProviderOptionsFor(
        buildConfig({
          model: AgentModel.Gemini35Flash,
          modelOptions: { temperature: 0.3, ...storedThinkingLevel("low") },
        }),
      ),
    ).toEqual({
      temperature: 0.3,
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "low", includeThoughts: true } },
      },
    })
  })

  it("drops a stored temperature the model no longer takes, and keeps the thinking level", () => {
    expect(
      new TestableProvider().specificProviderOptionsFor(
        buildConfig({
          model: AgentModel.Gemini36Flash,
          modelOptions: { temperature: 0.3, ...storedThinkingLevel("high") },
        }),
      ),
    ).toEqual({
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
      },
    })
  })

  it("falls back to the model's defaults when the stored thinking level is not one it accepts", () => {
    expect(
      new TestableProvider().specificProviderOptionsFor(
        buildConfig({
          model: AgentModel.Gemini37Flash,
          modelOptions: storedThinkingLevel("minimal"),
        }),
      ),
    ).toEqual({
      providerOptions: {
        vertex: { thinkingConfig: { thinkingLevel: "medium", includeThoughts: true } },
      },
    })
  })

  it("applies the service tier over the stored options", () => {
    expect(
      new TestableProvider().specificProviderOptionsFor(
        buildConfig({
          model: AgentModel.Gemini35FlashLite,
          modelOptions: storedThinkingLevel("low"),
          serviceTier: "priority",
        }),
      ),
    ).toEqual({
      providerOptions: {
        vertex: {
          sharedRequestType: "priority",
          thinkingConfig: { thinkingLevel: "low", includeThoughts: true },
        },
      },
    })
  })
})

describe("AISDKVertex3Provider service tier", () => {
  class TestableProvider extends AISDKVertex3Provider {
    public providerOptionsFor(config: LLMConfig) {
      return this.buildSpecificProviderOptions({ config }).providerOptions
    }
  }
  const buildConfig = (serviceTier: LLMServiceTier): LLMConfig =>
    ({ model: AgentModel.Gemini35Flash, serviceTier }) as LLMConfig

  it("serviceTier : priority - should set vertex.sharedRequestType = priority", () => {
    expect(new TestableProvider().providerOptionsFor(buildConfig("priority"))).toEqual({
      vertex: {
        sharedRequestType: "priority",
        thinkingConfig: { includeThoughts: true, thinkingLevel: "medium" },
      },
    })
  })

  it("serviceTier : flex - should set vertex.sharedRequestType = flex", () => {
    expect(new TestableProvider().providerOptionsFor(buildConfig("flex"))).toEqual({
      vertex: {
        sharedRequestType: "flex",
        thinkingConfig: { includeThoughts: true, thinkingLevel: "medium" },
      },
    })
  })

  it("serviceTier : undefined - should NOT set vertex.sharedRequestType", () => {
    expect(new TestableProvider().providerOptionsFor(buildConfig(undefined))).toEqual({
      vertex: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel: "medium",
        },
      },
    })
  })
})

describe("AISDKVertex3Provider thinking level", () => {
  class TestableProvider extends AISDKVertex3Provider {
    public thinkingLevelFor(config: LLMConfig) {
      const { providerOptions } = this.buildSpecificProviderOptions({ config })
      return (providerOptions?.vertex as { thinkingConfig: { thinkingLevel: string } })
        .thinkingConfig.thinkingLevel
    }
  }
  const buildConfig = (model: AgentModel, thinkingLevel?: string): LLMConfig => ({
    model,
    serviceTier: undefined,
    ...(thinkingLevel
      ? {
          modelOptions: {
            providerOptions: {
              vertex: { thinkingConfig: { thinkingLevel, includeThoughts: true } },
            },
          },
        }
      : {}),
  })

  it.each([
    [AgentModel.Gemini31FlashLite, "minimal"],
    [AgentModel.Gemini35FlashLite, "minimal"],
    [AgentModel.Gemini35Flash, "medium"],
    [AgentModel.Gemini36Flash, "medium"],
    [AgentModel.Gemini37Flash, "medium"],
    [AgentModel.Gemini38Flash, "medium"],
  ])("runs %s on its official default level when the agent stores none", (model, level) => {
    expect(new TestableProvider().thinkingLevelFor(buildConfig(model))).toBe(level)
  })

  it.each([
    "minimal",
    "low",
    "medium",
    "high",
  ])("runs the stored %s level on a model that accepts it", (level) => {
    expect(
      new TestableProvider().thinkingLevelFor(buildConfig(AgentModel.Gemini35Flash, level)),
    ).toBe(level)
  })

  it("runs the model's default level when the stored one is not accepted (minimal, 3.7 and up)", () => {
    expect(
      new TestableProvider().thinkingLevelFor(buildConfig(AgentModel.Gemini37Flash, "minimal")),
    ).toBe("medium")
  })

  it("tags the call with the level it runs on", () => {
    const tags = new AISDKVertex3Provider().getModelMetadata(
      buildConfig(AgentModel.Gemini35Flash, "low"),
    )
    expect(tags["thinkingLevel"]).toBe("LOW")
  })

  it("throws on a model the provider does not serve", () => {
    expect(() =>
      new TestableProvider().thinkingLevelFor(buildConfig(AgentModel._Mock, "minimal")),
    ).toThrow()
  })
})

if (process.env.IS_TEST === "true" && process.env.VERTEX3_TEST === "true") {
  describe("AISDKVertex3Provider", () => {
    jest.setTimeout(60_000)
    const traceProvider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
    })
    let provider: AISDKVertex3Provider
    beforeAll(async () => {
      const conf = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (!conf) return
      provider = new AISDKVertex3Provider()
      traceProvider.register()
    })
    afterAll(async () => {
      await traceProvider.forceFlush()
      await traceProvider.shutdown()
      await sdk.shutdown()
    })
    it("gcpCredentialsCheck", async () => {
      const check = await gcpCredentialsCheck()
      expect(check).toBeTruthy()
    })

    it.each(testModels)("generateText - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateText({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -pdf - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromPdf({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -jpg - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromMathematicalJpg({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -png - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromXRayPng_FR({ provider, model })
    })
    it.each(testModels)("generateStructuredOutput -png (low res) - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromXRayLowPng_FR({ provider, model })
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
    it.each(testModels)("streamChatResponse with tools - BIS - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithToolsBis({
        provider,
        model,
        advancedExpectation: true,
      })
    })
    it.each(testModels)("streamChatResponse with tools - TER - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithToolsTer({
        provider,
        model,
        advancedExpectation: true,
      })
    })
    it.each(testModels)("streamChatResponse with multiple tools - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithMultipleTools({
        provider,
        model,
        advancedExpectation: true,
      })
    })
  })
} else {
  describe.skip("AISDKVertexProvider", () => {
    it("skipped (requires process.env.IS_TEST=true and process.env.VERTEX_TEST=true)", () => {})
  })
}

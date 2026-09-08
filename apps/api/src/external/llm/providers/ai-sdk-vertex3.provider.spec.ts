import {
  AgentModel,
  AgentModelMetadataMap,
  AgentModelToAgentProvider,
  AgentProvider,
} from "@caseai-connect/api-contracts"
import { afterAll, beforeAll } from "@jest/globals"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import type { LLMConfig, LLMServiceTier } from "@/common/interfaces/llm-provider.interface"
import { LangfuseIntegrationExporter } from "@/external/langfuse/langfuse-integration-exporter"
import { GetAgentModelKeyFromValue } from "@/external/llm/agent-provider"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AISDKVertex3Provider } from "@/external/llm/providers/ai-sdk-vertex3.provider"
import { ProviderSpecs } from "@/external/llm/providers/provider-specs"
import { gcpCredentialsCheck } from "@/external/llm/providers/spec-gcp-tools"

const testModels = Object.values(AgentModel)
  .filter(
    (am) =>
      AgentModelToAgentProvider[am] === AgentProvider.Vertex3 &&
      process.env.VERTEX3_TEST === "true",
  )
  .map((m) => ({
    name: GetAgentModelKeyFromValue(m),
    model: m,
  }))

// Endpoint routing is decided from the shared model catalog, with no call to Vertex, so this
// runs everywhere — unlike the live generation specs below, which need credentials.
describe("AISDKVertex3Provider location routing", () => {
  const locationOf = (model: AgentModel) =>
    new AISDKVertex3Provider().getTags({ model, temperature: 0, serviceTier: undefined })[1]

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
    // No catalog entry carries the flag today, so it is seeded on the real catalog and restored:
    // the assertion is about the routing, not about the current data.
    const metadata = AgentModelMetadataMap[AgentModel.Gemini36Flash]
    metadata.servedOutsideEu = true
    try {
      expect(locationOf(AgentModel.Gemini36Flash)).toBe("global")
    } finally {
      delete metadata.servedOutsideEu
    }
  })
})

describe("AISDKVertex3Provider service tier", () => {
  class TestableProvider extends AISDKVertex3Provider {
    public providerOptionsFor(config: LLMConfig) {
      return this.buildNativeProviderOptions({ config })
    }
  }
  const buildConfig = (serviceTier: LLMServiceTier): LLMConfig =>
    ({ model: AgentModel.Gemini35Flash, temperature: 0, serviceTier }) as LLMConfig

  it("serviceTier : priority - should set vertex.sharedRequestType = priority", () => {
    expect(new TestableProvider().providerOptionsFor(buildConfig("priority"))).toEqual({
      vertex: { sharedRequestType: "priority" },
    })
  })

  it("serviceTier : flex - should set vertex.sharedRequestType = flex", () => {
    expect(new TestableProvider().providerOptionsFor(buildConfig("flex"))).toEqual({
      vertex: { sharedRequestType: "flex" },
    })
  })

  it("serviceTier : undefined - should NOT set vertex.sharedRequestType", () => {
    expect(new TestableProvider().providerOptionsFor(buildConfig(undefined))).toEqual({})
  })
})

if (process.env.IS_TEST === "true" && process.env.VERTEX3_TEST === "true") {
  describe("AISDKVertex3Provider", () => {
    jest.setTimeout(60_000)
    const langfuse = new LangfuseIntegrationExporter({
      secretKey: process.env.LANGFUSE_SK,
      publicKey: process.env.LANGFUSE_PK,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    })
    const traceProvider = new NodeTracerProvider({
      spanProcessors: [
        new BatchSpanProcessor(new ConsoleSpanExporter()),
        new BatchSpanProcessor(langfuse),
      ],
    })
    let provider: AISDKVertex3Provider
    beforeAll(async () => {
      const conf = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (!conf) return
      provider = new AISDKVertex3Provider()
      traceProvider.register()
    })
    afterAll(async () => {
      await langfuse.forceFlush()
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
